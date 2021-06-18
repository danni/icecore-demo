import React, { useMemo } from "react";
import { AxisLeft, AxisBottom } from "@vx/axis";
import { scaleBand, scaleLinear } from "@vx/scale";
import { interpolateRdBu } from "d3-scale-chromatic";

import "./App.css";
import rawData from "./data.json";

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

  const yMax = useMemo(() => Math.max(...data.map(({ y }) => y)), [data]);

  const xScale = scaleBand<number>({
    domain: data.map(({ x }) => x),
  });
  const yScale = scaleLinear<number>({
    domain: [0, yMax],
    nice: true,
  });
  const cScale = interpolateRdBu;

  xScale.range([0, width]);
  yScale.range([height, 0]);

  return (
    <div className="App">
      <svg
        width={width}
        height={height}
        style={{
          overflow: "visible", // axes overflow the SVG viewbox
        }}
      >
        {/* Set up the axes */}
        <AxisBottom scale={xScale} top={height} />
        <AxisLeft scale={yScale} />

        {/* Plot the data */}
        {data.map(({ x, y, c }) => (
          <rect
            x={xScale(x)}
            y={yScale(y)}
            width={xScale.bandwidth()}
            height={height - (yScale(y) ?? 0)}
            fill={cScale(c)}
          />
        ))}
      </svg>
    </div>
  );
}

export default App;
