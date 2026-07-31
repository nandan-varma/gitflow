import { describe, it, expect } from "vitest";
import { extractLegacyApiKey } from "./aiKeyStore";

describe("extractLegacyApiKey", () => {
  it("returns null for missing settings blob", () => {
    expect(extractLegacyApiKey(null)).toEqual({ legacy: null, scrubbedJson: null });
  });

  it("returns null when the blob has no aiApiKey field", () => {
    const blob = JSON.stringify({ theme: "dark" });
    expect(extractLegacyApiKey(blob)).toEqual({ legacy: null, scrubbedJson: null });
  });

  it("returns null for an empty-string aiApiKey", () => {
    const blob = JSON.stringify({ aiApiKey: "" });
    expect(extractLegacyApiKey(blob)).toEqual({ legacy: null, scrubbedJson: null });
  });

  it("extracts a legacy key and scrubs it from the returned JSON", () => {
    const blob = JSON.stringify({ theme: "dark", aiApiKey: "sk-secret", aiModel: "gpt-5" });
    const { legacy, scrubbedJson } = extractLegacyApiKey(blob);
    expect(legacy).toBe("sk-secret");
    expect(scrubbedJson).not.toBeNull();
    const scrubbed = JSON.parse(scrubbedJson!);
    expect(scrubbed).not.toHaveProperty("aiApiKey");
    expect(scrubbed.theme).toBe("dark");
    expect(scrubbed.aiModel).toBe("gpt-5");
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(extractLegacyApiKey("not json")).toEqual({ legacy: null, scrubbedJson: null });
  });
});
