import { describe, expect, it } from "vitest";
import {
  connexionUrl,
  normalizeExternalUrl,
  normalizePhoneNumber,
  safeExternalUrl,
  safeReturnTo,
  socialUrl,
} from "./urls";

describe("safeExternalUrl", () => {
  it("n'accepte que HTTP et HTTPS", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,test")).toBeNull();
    expect(safeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("retire les identifiants intégrés à une URL", () => {
    expect(safeExternalUrl("https://user:secret@example.com/a")).toBe("https://example.com/a");
  });

  it("normalise un domaine saisi sans protocole", () => {
    expect(normalizeExternalUrl("example.com")).toBe("https://example.com/");
  });
});

describe("liens internes", () => {
  it("bloque les redirections ouvertes", () => {
    expect(safeReturnTo("//evil.example/path")).toBe("/deposer");
    expect(safeReturnTo("https://evil.example/path")).toBe("/deposer");
    expect(safeReturnTo("/annonce/123?source=favori")).toBe("/annonce/123?source=favori");
  });

  it("construit un lien de connexion encodé", () => {
    expect(connexionUrl("/event/proposer")).toBe("/connexion?returnTo=%2Fevent%2Fproposer");
  });
});

describe("coordonnées", () => {
  it("valide les numéros internationaux", () => {
    expect(normalizePhoneNumber("+590 690 12-34-56")).toBe("+590690123456");
    expect(normalizePhoneNumber("0690123456")).toBeNull();
  });

  it("refuse les caractères dangereux dans un identifiant social", () => {
    expect(socialUrl("instagram", "@ti.kanal")).toBe("https://www.instagram.com/ti.kanal/");
    expect(socialUrl("instagram", "name/../../evil")).toBeNull();
  });
});

