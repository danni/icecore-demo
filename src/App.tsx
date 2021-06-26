import React, { useMemo, useState } from "react";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { RectClipPath } from "@visx/clip-path";
import { Text } from "@visx/text";
import { interpolateRdBu } from "d3-scale-chromatic";
import { ParentSizeModern as ParentSize } from "@visx/responsive";
import { localPoint } from "@visx/event";
import { ScaleLinear } from "d3-scale";
import { ActiveListener } from "react-event-injector";

import "./App.css";
import useTweenState from "./useTweenState";
import useInertialState from "./useInertialState";
import rawData from "./data.json";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface GraphProps {
  width: number;
  height: number;

  margin?: number;

  xScaleFactor: number;
  xOffset: number;

  data: Array<{
    x: number;
    y: number;
    c: number;
  }>;

  context: Array<{
    x1: number;
    x2: number;
    c: string;
    label: string;
  }>;
}

interface ScaleProps {
  xScale: ScaleLinear<number, number>;
  yScale: ScaleLinear<number, number>;
}

function ContextBlocks({
  context,
  xScale,
  height,
}: Pick<GraphProps, "context" | "height"> & ScaleProps) {
  // Calculate and cache the context
  // N.B. this doesn't depend on xOffset, so scrolling should be nice and
  // fast
  const blocks = useMemo(
    () =>
      context.map(({ x1, x2, c, label }) => (
        <Group key={x1} left={xScale(x1)}>
          <rect
            x={0}
            width={xScale(x2 - x1 + 1)}
            y={0}
            height={height}
            fill={c}
          />
          <Text angle={90} dx={5} dy={5} width={height}>
            {label}
          </Text>
        </Group>
      )),
    [context, xScale, height]
  );

  return <Group>{blocks}</Group>;
}

function DataBars({
  data,
  xScale,
  yScale,
  height,
}: Pick<GraphProps, "data" | "height"> & ScaleProps) {
  // Colour scale
  const cScale = interpolateRdBu;

  // Calculate and cache the bars
  // N.B. this doesn't depend on xOffset, so scrolling should be nice and
  // fast
  const bars = useMemo(
    () =>
      data.map(({ x, y, c }) => (
        <rect
          key={x}
          x={xScale(x - 0.5)} // Center bar around the year
          y={yScale(y)}
          width={xScale(1)} // Bar is one year wide
          height={height - (yScale(y) ?? 0)}
          strokeWidth={0}
          fill={cScale(c)}
        />
      )),
    [data, xScale, yScale, cScale, height]
  );

  return <Group>{bars}</Group>;
}

// A function to clamp the xOffset to the visisble data
function xOffsetClamp(width: number, offset: number, scaleFactor: number) {
  return clamp(offset, -width * (scaleFactor - 1), 0);
}

function Graph({
  // Data
  data,
  context,
  // Properties
  width, // Size of the drawing area (in px)
  height,
  margin = 30, // px
  xScaleFactor, // Scaling factor
  xOffset, // Panning offset
}: GraphProps) {
  // Remove the margin from the render width and height
  width -= margin;
  height -= margin;

  // Calculate and store x-axis scale
  // scales are used for converting between the range and the domain
  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(...data.map(({ x }) => x))], // Calculate the maximum value of the data
        // The width of the canvas is the true width * scaling factor
        range: [0, width * xScaleFactor],
      }),
    [data, width, xScaleFactor]
  );

  // Calculate and store y-axis scale
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        // Calculate the maximum value of the data
        domain: [0, Math.max(...data.map(({ y }) => y))], // Calculate the maximum value of the data
        range: [height, 0],
        nice: true,
      }),
    [data, height]
  );

  if (height <= 0 || width <= 0) return null;

  return (
    // Translate the group to leave space for the axes
    <Group left={margin}>
      {/* Clip path for panning to remove overflow */}
      <RectClipPath id="clip-path" width={width} height={height + margin} />
      <Group clipPath="url(#clip-path)">
        {/* Translate for the panning offset */}
        <Group left={xOffset}>
          {/* These go in order from back to frontata */}
          {/* Plot the data */}
          <ContextBlocks
            context={context}
            xScale={xScale}
            yScale={yScale}
            height={height}
          />
          <DataBars
            data={data}
            xScale={xScale}
            yScale={yScale}
            height={height}
          />

          {/* Bottom axis scrolls with the group */}
          <AxisBottom
            scale={xScale}
            top={height}
            hideZero
            numTicks={10 * xScaleFactor}
            tickFormat={(tick) => tick.toString()}
          />
        </Group>
      </Group>

      {/* Left axis goes last to drop it on top, it is outside the panning group */}
      <AxisLeft scale={yScale} />
    </Group>
  );
}

function App() {
  // Normalise the data into flat arrays
  // This can be done in a selector etc.
  const context = useMemo(
    () =>
      rawData.context.map((record, index) => ({
        x1: record.startYear,
        x2: record.endYear,
        label: record.heading,
        c: index % 2 ? "white" : "lightgrey",
      })),
    []
  );

  const data = useMemo(
    () =>
      rawData.graphDataPoint.map((record) => ({
        x: record.year,
        y: record.co2Ppm,
        c: 1 - record.normalizedAnomaly,
      })),
    []
  );

  const [panning, setPanning] = useState<boolean>(false);
  const [xScaleFactor, setXScaleFactor, xScaleFactorTarget] = useTweenState(1);
  // Inertial scroll xOffset
  const [xOffset, setXOffset, xOffsetTarget] = useInertialState(0);
  // An additional xOffset (used for tweening the xOffset during a zoom)
  const [xOffsetDelta, setXOffsetDelta] = useTweenState(0);

  // Pan the screen by a delta
  const panGraph = (delta: number, width: number) => {
    let offset = xOffset;

    // Copy any tweening offset to the panning offset and zero out the
    // tweening offset
    if (xOffsetDelta !== 0) {
      offset += xOffsetDelta;
      setXOffset(offset);

      setXOffsetDelta(0, false);
    }

    setXOffset(xOffsetClamp(width, offset + delta, xScaleFactor));
  };

  const zoomGraph = (delta: number, width: number, x: number, tween: boolean = true) => {
    // Calculate the ratio of the click to the virtual width
    const alpha = (x - xOffset - xOffsetDelta) / (width * xScaleFactor);

    // Tween the zoom
    setXScaleFactor(xScaleFactorTarget + delta, tween);

    // Tween the offset to maintain the same ratio to the left hand side
    setXOffsetDelta(xOffsetDelta - alpha * delta * width, tween);
  };

  return (
    <div className="App">
      {/* Graph */}
      <ParentSize>
        {({ width, height }) => (
          <ActiveListener
            onMouseDown={() => setPanning(true)}
            onMouseUp={() => setPanning(false)}
            onMouseMove={(event) => panning && panGraph(event.movementX, width)}
            onWheel={(event) => {
              event.preventDefault();
              if (event.deltaX === 0) {
                // Pinch zoom
                const point = localPoint(event as any) ?? { x: 0 };
                zoomGraph(-event.deltaY / 20, width, point.x, false)
              } else {
                // Two finger scroll
                panGraph(-event.deltaX, width);
              }
            }}
          >
            <svg
              width={width}
              height={height}
              onDoubleClick={(event) => {
                const point = localPoint(event) ?? { x: 0 };

                zoomGraph(1, width, point.x)
              }}
            >
              <Graph
                data={data}
                context={context}
                width={width}
                height={height}
                xScaleFactor={xScaleFactor}
                xOffset={xOffsetClamp(
                  width,
                  xOffset + xOffsetDelta,
                  xScaleFactor
                )}
              />
            </svg>
          </ActiveListener>
        )}
      </ParentSize>

      {/* Scale controls */}
      <div>
        <button
          onClick={() => setXScaleFactor(Math.max(xScaleFactorTarget - 1, 1))}
        >
          -
        </button>
        {xScaleFactor.toPrecision(3)} target:{" "}
        {xScaleFactorTarget.toPrecision(3)}
        <button onClick={() => setXScaleFactor(xScaleFactorTarget + 1)}>
          +
        </button>
      </div>

      {/* Pan controls */}
      <div>
        <button onClick={() => setXOffset(xOffsetTarget - 10)}>&lt;-</button>
        {xOffset} target: {xOffsetTarget} delta: {xOffsetDelta}
        <button onClick={() => setXOffset(xOffsetTarget + 10)}>-&gt;</button>
        {panning && "panning"}
      </div>
    </div>
  );
}

export default App;
