import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../scripts/upstream-changes.js";

test("classify sorts the old repo's diff into posts, images and authors", () => {
  const r = classify(
    [
      "A\t_source/_posts/2026-10-09-typescript-mcp-sdk-cross-app-access.md",
      "M\t_source/_posts/2026-07-03-cross-app-access-saml.md",
      "M\t_source/_posts/2019-08-28-reactive-microservices-spring-cloud-gateway.adoc",
      "D\t_source/_posts/2017-03-16-spring-boot-saml.md",
      "R100\t_source/_posts/old-name.md\t_source/_posts/2026-01-01-new-name.md",
      "A\t_source/_assets/img/blog/typescript-mcp-sdk-cross-app-access/social.jpg",
      "M\t_source/_assets/img/blog/xaa-oidc-requesting/resource-app-config.jpg",
      "M\t_source/_data/authors.yml",
      "M\t_source/_includes/setup/integrator.md",
      "",
    ].join("\n"),
  );
  assert.deepEqual(r.added, ["2026-10-09-typescript-mcp-sdk-cross-app-access"]);
  assert.deepEqual(r.modified, [
    "2026-07-03-cross-app-access-saml",
    "2019-08-28-reactive-microservices-spring-cloud-gateway",
    "2026-01-01-new-name",
  ]);
  assert.deepEqual(r.deleted, ["2017-03-16-spring-boot-saml"]);
  assert.deepEqual(r.images, [
    "typescript-mcp-sdk-cross-app-access/social.jpg",
    "xaa-oidc-requesting/resource-app-config.jpg",
  ]);
  assert.equal(r.authors, true);
});

test("classify of an empty diff reports nothing", () => {
  assert.deepEqual(classify(""), {
    added: [],
    modified: [],
    deleted: [],
    images: [],
    authors: false,
  });
});
