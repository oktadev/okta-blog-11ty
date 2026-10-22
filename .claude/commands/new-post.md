Create a new blog post for the okta-blog. Arguments: $ARGUMENTS

SEO work must happen BEFORE the post is created — keywords drive the slug, title, headers, and description.

## Steps

1. **Identify SEO keywords (do this first).**
   - Ask the user: "Have you already identified your 2-3 SEO keywords from Google Keyword Planner?"
   - If not, remind them of the process:
     - Go to Google Keyword Planner, remove USA as the market region, and search with generic 2-3 word phrases (e.g. "python chatbot" not "okta documentation chatbot")
     - Target keywords with 300+ avg monthly searches; balance search volume against the integrity of the post
     - Pick 2-3 final keywords — these will feed everything below
   - Once keywords are confirmed, proceed.

2. **Gather post info.** Parse $ARGUMENTS for a post slug if provided. Ask the user for any missing required fields:
   - **Post slug** — the SEO keywords in kebab-case, used as the filename and image directory (e.g. `python-chatbot`). This is what `npm run post create` embeds into the URL — make it count.
   - **Title** — must include the keywords. Format in **Chicago style** title case:
     - Capitalize: first word, last word, all nouns, verbs, adjectives, adverbs, and pronouns
     - Lowercase: articles (a, an, the), coordinating conjunctions (and, but, or, nor, for, so, yet), and prepositions (in, on, at, by, for, with, to, of, from, about, etc.)
     - Hyphenated compounds: capitalize each element (e.g., `Low-Code`, not `Low-code`)
     - Run it through https://www.monsterinsights.com/headline-analyzer/ and aim for a high overall score before settling on the final title.
   - **Author slug** — must match a key in `src/_data/authors.yaml` (e.g. `semona-igama`)
   - **Description** — compelling, ~150 characters max; this feeds the post preview so make people want to click. Must include keywords.
   - **Communities** — comma-separated list from: `security`, `javascript`, `java`, `python`, `go`, `php`, `ruby`, `.net`, `mobile`, `devops` (pick all that apply)
   - **Tags** — comma-separated lowercase kebab-case tags relevant to the post content (e.g. `oauth, api-security, nodejs`)
   - **Type** — `awareness` (educational/thought leadership) or `conversion` (drives product adoption)
   - **GitHub repo URL** (optional) — link to a companion code repository
   - **Social image** (optional) — whether a social/cover image will be added (yes/no)

3. **Verify the author slug exists.**
   - Run: `grep -n "^{author-slug}:" src/_data/authors.yaml`
   - If no match is found, warn the user and ask them to confirm the slug or run `/new-author` first.

4. **Create the post and image directory using the project script.**
   - Run: `npm run post create {post-slug}`
   - This creates two things at once:
     - `src/blog/posts/{YYYY-MM-DD}-{post-slug}.md` — the post file with a blank front matter template
     - `public/img/blog/{post-slug}/` — the image directory for this post

5. **Extract images from PDF (only if the source content is a PDF).**
   - Check if `pymupdf` is installed: `python3 -c "import fitz"` — if it fails, install it: `pip3 install pymupdf --quiet`
   - Inspect how many images are embedded in the PDF and which page each is on:
     ```python
     import fitz
     doc = fitz.open("path/to/source.pdf")
     for i, page in enumerate(doc):
         images = page.get_images(full=True)
         print(f"Page {i+1}: {len(images)} image(s), size {images[0][2]}x{images[0][3]}" if images else f"Page {i+1}: no images")
     ```
   - Based on the page content and position in the post, assign each image a descriptive kebab-case filename (e.g. `community-collage.jpg`, `mongodb-event.jpg`).
   - Extract and save each image to `public/img/blog/{post-slug}/`:
     ```python
     import fitz, os
     doc = fitz.open("path/to/source.pdf")
     filenames = ["first-image.jpg", "second-image.jpg"]  # one per page with an image
     out_dir = "public/img/blog/{post-slug}"
     for page_num, page in enumerate(doc):
         images = page.get_images(full=True)
         if images:
             xref = images[0][0]
             img = doc.extract_image(xref)
             with open(os.path.join(out_dir, filenames[page_num]), "wb") as f:
                 f.write(img["image"])
     ```
   - Note the filenames — they will be referenced in the post body (see the embed syntax in the final summary step).

6. **Fill in the front matter.**
   - Open the generated post file and fill in the fields of the scaffolded front matter (don't replace the block). Set `by` to `advocate` unless the user says otherwise (`advocate`, `contractor`, `internal-contributor`, or `external-contributor`). Leave `tweets:` empty. There is no `layout` field; posts get their layout from `posts.11tydata.js`. Omit optional fields that were not provided:

     ```markdown
     ---
     title: "{Title}"
     author: {author-slug}
     by: advocate
     communities: [{community1}, {community2}]
     description: "{Description}"
     tags: [{tag1}, {tag2}]
     tweets:
     image: {post-slug}/social.jpg   # relative to public/img/blog/; omit line if no social image
     github: {github_url}             # omit line if not provided
     type: {awareness|conversion}
     ---
     ```

7. **Apply style guide standards to the post body.**
   - **Acronyms**: spell out on first use with abbreviation in parentheses: "single sign-on (SSO)". Common exceptions that don't need defining: JSON, HTTP, API. Subsequent uses can use the abbreviation alone.
   - **Bold**: reserved for UI elements only (button labels, menu items, field names). Do not bold for emphasis or to label list items.
   - **Internal links**: `developer.okta.com` links must use relative paths: `/docs/guides/...` not `https://developer.okta.com/docs/guides/...`
   - **Ellipsis**: use three plain periods `...` not the Unicode ellipsis character `…`
   - **Smart quotes**: use straight quotes `"` and `'` not curly/smart quotes `"` `"` `'` `'` (curly quotes usually mean the text was pasted from Google Docs with smart quotes on)

8. **Check for passive voice and suggest active rewrites.**
   - Scan every sentence in the post body. Passive voice signals to look for:
     - `is/are/was/were + past participle` (e.g. "was built", "are recognized")
     - `has/have been + past participle` (e.g. "has been earned", "have been added")
     - `by` phrases where the real actor is buried at the end (e.g. "the feature was shipped by the team")
   - For each passive sentence found, apply the test: **"Who is doing the action?"** If the answer is not the grammatical subject of the sentence, it is passive.
   - Suggest an active rewrite where the actor becomes the subject:
     - Passive: "I have since earned recognition as a MongoDB Champion" → Active: "I earned my MongoDB Champion recognition" *(actor already subject — fine)*
     - Passive: "Workshops were led by me over the years" → Active: "I led workshops over the years"
     - Passive: "The content was written to help developers" → Active: "I wrote the content to help developers"
   - Present each suggestion as: `[passive sentence] → [suggested active rewrite]` and ask the user to confirm or adjust.
   - **Exceptions — do not flag these**:
     - Passive is acceptable when the actor is unknown or irrelevant ("the endpoint is deprecated")
     - Passive is acceptable when the receiver of the action is the intentional focus ("developers are supported through every step")
     - Intentional stylistic choices the user has already confirmed

9. **Remind about SEO in the post body.**
   - **Do not start the post with a header.** The post body must open with introductory text — a paragraph that hooks the reader. The first `##` header should appear after the opening paragraph(s).
   - **H2 and H3 headers directly impact SEO.** Headers must incorporate the keywords plus context-specific terms (Okta-specific, technology names, etc.). A header like "Set up Okta" does nothing; "Add OIDC authentication to Python apps using Okta" is far better.
   - Use **sentence case** for all H2 and H3 headers: capitalize only the first word and proper nouns (product names, acronyms, brand names). Example: `## How to build low-code API integrations with Okta Workflows`
   - Remove any placeholder `## Introduction` header — the opening paragraph IS the introduction.

10. **Check images.**
   - **Image filenames must use kebab-case** (e.g. `add-integration-capabilities.jpeg`, not `addIntegrationCapabilities.jpeg`). Rename any camelCase files before adding them to the post.
   - There is no image optimizer script in this repo, so these limits are editorial guidance that nothing enforces yet. Check them by hand once all images are in `public/img/blog/{post-slug}/`:
     - Under **400 KB** each (`ls -l public/img/blog/{post-slug}/`)
     - Between 800 and 1800 px wide (`sips -g pixelWidth <file>`)
   - Compress anything over the limit (for example `sips -s formatOptions 70 --out <dest> <src>` for JPG) and keep the clean filename so post references don't change. Ask before deleting an oversized original.
   - Prefer JPEG over PNG for blog post images.

11. **Verify the result.**
   - Confirm both paths exist:
     - `ls src/blog/posts/{YYYY-MM-DD}-{post-slug}.md`
     - `ls public/img/blog/{post-slug}/`
   - Read back the front matter and show it to the user.

12. **Summary.** Report what was created:
   - Full path of the new post file
   - Full path of the new image directory
   - If a social image was indicated:
     - Place it at `public/img/blog/{post-slug}/social.jpg`
     - Social images must be **1600×900 px** — use the "Twitter Ad" template on Canva
   - In the post body, embed images with:
     ```
     {% img {src: "{post-slug}/{image-file}", alt: "description", header: "800"} %}
     ```
   - **CTA**: every post must end with the following call-to-action paragraph (after the last section):
     ```
     Remember to follow us on [X](https://x.com/oktadev) and subscribe to our [YouTube channel](https://www.youtube.com/c/OktaDev/) for more exciting content. We also want to hear from you about the topics you'd like to see and any questions you may have. Leave us a comment below!
     ```
