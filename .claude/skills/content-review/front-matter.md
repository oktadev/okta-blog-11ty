# Front Matter Validation

For blog post files, check for the following required fields:

| Field | Rule |
|-------|------|
| `layout` | Do not set. Posts get their layout from `posts.11tydata.js`. |
| `title` | Required. Chicago title case. |
| `author` | Required. Must match an author slug. |
| `by` | Required. Must be `advocate`, `contractor`, `internal-contributor`, or `external-contributor`. |
| `description` | Required. 150 characters or less. This displays in previews. |
| `communities` | Required. Must be one of `javascript`, `java`, `.net`, `security`, `devops`, `mobile`, `php`, `python`, `go`, `ruby`. |
| `tags` | Required. Any relevant tags. |
| `type` | Required. Must be `awareness` or `conversion`. |
| `image` | Required if a banner image exists. Path is relative to `public/img/blog/`, for example `<post-slug>/social.jpg`. |
| `tweets` | Unused. Leave empty; do not flag it as missing. |
| `github` | Required if the article includes a code example repo. |
| `changelog` | Required if this content is a material change to an existing post, otherwise do not include it. A list of `- YYYY-MM-DD: text` entries. |
| `updated` | Set on an old post that a newer post supersedes: `slug`, or `url` and `title` if the new post is not in this repo yet, plus optional `extra`. Renders the "this post is old" banner. |
| `canonical` | Required if syndicated or multiple URLs point to this article. |

---

## Tags

- ❌ Flag any new tags. Tags feed into a tag view of related posts. There is no value to a tag only being used in one post. A new tag could establish a precedent for upcoming related posts, but if the user isn't aware of upcoming posts using a new tag, they shouldn't use them.
