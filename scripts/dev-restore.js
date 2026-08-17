// Restore the posts removed by `npm run dev-clean` (a git checkout of the posts
// directory). Untracked posts you added stay put.
import { execSync } from "node:child_process";

execSync("git checkout -- src/blog/posts", { stdio: "inherit" });
console.log("Restored src/blog/posts from git.");
