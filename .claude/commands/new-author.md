Create a new author entry for the okta-blog. Arguments: $ARGUMENTS

## Steps

1. **Gather author info.** Parse $ARGUMENTS for a slug (lowercase-hyphenated, e.g. `jane-doe`). If not provided, ask the user for:
   - Author slug (lowercase, hyphen-separated — this becomes the YAML key and avatar filename prefix)
   - Full name
   - Display name (can match full name)
   - Avatar image path (local file the user has on disk)
   - Bio
   - Twitter URL (optional)
   - GitHub URL (optional)
   - LinkedIn URL (optional)
   - Personal website URL (optional)
   - Email (optional)

2. **Handle the avatar image.**
   - Avatars must be in color, head and shoulders only, **max 500×500 px** and **max 40 KB**.
   - Determine the source image extension. The destination filename must be `avatar-{slug}.{ext}` placed at `public/img/avatar/`. Prefer JPG.
   - If either dimension is over 500 px, downscale with `sips` (keeps the aspect ratio, longest side becomes 500):
     ```
     sips -Z 500 /path/to/source/image
     ```
   - Copy (or move if the user prefers) the resized image to `public/img/avatar/avatar-{slug}.{ext}`.
   - Confirm the final dimensions with `sips -g pixelWidth -g pixelHeight` and the size with `ls -l`. If the file is over 40 KB, recompress it (for example `sips -s formatOptions 70 --out <dest> <src>` for JPG) and check again.

3. **Add the author to `src/_data/authors.yaml`.**
   - Append the new entry at the end of the file (before the final newline if one exists), separated from the previous entry by a blank line.
   - Only include optional fields (twitter, github, linkedin, web, email) if the user supplied them.
   - Use this format exactly, matching indentation of existing entries (2-space indent for fields):

     ```yaml
     {slug}:
       full_name: {Full Name}
       display_name: {Display Name}
       avatar: avatar-{slug}.{ext}
       twitter: {twitter_url}        # omit line if not provided
       github: {github_url}          # omit line if not provided
       linkedin: {linkedin_url}      # omit line if not provided
       web: {web_url}                # omit line if not provided
       email: {email}                # omit line if not provided
       bio: "{bio text}"
     ```

4. **Verify the result.**
   - Read back the newly added section from `authors.yaml` and show it to the user.
   - Confirm the avatar file exists at the correct path with correct dimensions and size.

5. **Summary.** Report what was created:
   - The YAML key added to `authors.yaml`
   - The avatar path, final dimensions, and file size
   - Remind the user that blog posts reference this author via `author: {slug}` in their front matter.
