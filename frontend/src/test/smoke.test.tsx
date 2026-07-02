import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Basit bir bileşen render testi (RTL kurulumunun çalıştığını doğrular)
function Hello({ name }: { name: string }) {
  return <h1>Merhaba {name}</h1>;
}

describe("RTL kurulumu", () => {
  it("bileşeni render eder", () => {
    render(<Hello name="VIA" />);
    expect(screen.getByText("Merhaba VIA")).toBeInTheDocument();
  });
});
