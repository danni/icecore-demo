import React, { useMemo, useState, useCallback } from "react";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { RectClipPath } from "@visx/clip-path";
import { interpolateRdBu } from "d3-scale-chromatic";

import "./App.css";
import useTweenState from "./useTweenState";
import rawData from "./data.json";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface GraphProps {
  width: number;
  height: number;

  margin?: number;

  xScale: number;
  xOffset: number;

  data: {
    x: number;
    y: number;
    c: number;
  }[];
}

function Graph({
  data,
  width,
  height,
  margin = 30, // px
  xScale: xScaleFactor,
  xOffset,
}: GraphProps) {
  // Remove the margin from the render width and height
  width -= margin;
  height -= margin;

  // Calculate and store x-axis scale
  const xScale = useMemo(
    () =>
      scaleBand<number>({
        domain: data.map(({ x }) => x),
        range: [0, width * xScaleFactor],
      }),
    [data, width, xScaleFactor]
  );

  // Calculate and store y-axis scale
  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        // Calculate the maximum value of the data
        domain: [0, Math.max(...data.map(({ y }) => y))],
        range: [height, 0],
        nice: true,
      }),
    [data, height]
  );

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
          x={xScale(x)}
          y={yScale(y)}
          width={xScale.bandwidth()}
          height={height - (yScale(y) ?? 0)}
          fill={cScale(c)}
        />
      )),
    [data, xScale, yScale, cScale, height]
  );

  return (
    // Translate the group to leave space for the axes
    // Axes draw into the space
    <Group left={margin}>
      {/* Clip path for panning */}
      <RectClipPath id="clip-path" width={width} height={height + margin} />
      <Group clipPath="url(#clip-path)">
        {/* Translate for the scroll offset */}
        <Group left={xOffset}>
          {/* Bottom axis scrolls with the group */}
          <AxisBottom scale={xScale} top={height} />

          {/* We can plot other data sets in here too */}

          {/* Plot the data */}
          {bars}
        </Group>
      </Group>

      {/* Left axis goes last to drop it on top */}
      <AxisLeft scale={yScale} />
    </Group>
  );
}

function App() {
  const width = 1000; // px
  const height = 700; // px

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
  const [xScale, setXScale, xScaleTarget] = useTweenState(1);
  const [xOffset, setXOffset] = useState<number>(0);

  // A function to clamp the xOffset to the visisble data
  const xOffsetClamp = useCallback(
    (offset: number) => clamp(offset, -width * (xScale - 1), 0),
    [xScale, width]
  );

  return (
    <div className="App">
      <svg
        width={width}
        height={height}
        onMouseDown={() => setPanning(true)}
        onMouseUp={() => setPanning(false)}
        onMouseMove={(event) =>
          panning && setXOffset(xOffsetClamp(xOffset + event.movementX))
        }
      >
        <Graph
          data={data}
          width={width}
          height={height}
          xScale={xScale}
          xOffset={xOffsetClamp(xOffset)}
        />
      </svg>

      <div>
        <button onClick={() => setXScale(Math.max(xScaleTarget - 1, 1))}>
          -
        </button>
        {xScale.toPrecision(3)} target: {xScaleTarget}
        <button onClick={() => setXScale(xScaleTarget + 1)}>+</button>
      </div>

      <div>
        <button onClick={() => setXOffset(xOffset - 10)}>&lt;-</button>
        {xOffset}
        <button onClick={() => setXOffset(xOffset + 10)}>-&gt;</button>
        {panning && "panning"}
      </div>
    </div>
  );
}

export default App;
