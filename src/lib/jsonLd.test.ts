import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./jsonLd";

describe("serializeJsonLd", () => {
  it("empêche la fermeture de la balise script", () => {
    const result = serializeJsonLd({ title: "</script><script>alert(1)</script>" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
  });
});

