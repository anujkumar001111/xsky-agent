import { formatBytes } from "../../src/utils";

describe("formatBytes", () => {
  test("should return '0 Bytes' for 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  test("should format bytes correctly", () => {
    expect(formatBytes(1023)).toBe("1023 Bytes");
  });

  test("should format kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  test("should format megabytes correctly", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  test("should format gigabytes correctly", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  test("should format terabytes correctly", () => {
    expect(formatBytes(1099511627776)).toBe("1 TB");
  });

  test("should handle decimal values correctly", () => {
    expect(formatBytes(1500)).toBe("1.46 KB");
  });

  test("should return '0 Bytes' for negative numbers", () => {
    expect(formatBytes(-100)).toBe("0 Bytes");
  });
});
