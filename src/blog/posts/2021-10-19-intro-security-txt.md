---
disqus_thread_id: 8834610442
discourse_topic_id: 17425
discourse_comment_url: https://devforum.okta.com/t/17425
title: "Security.txt: Make Vulnerabilities Easier to Report"
author: brian-demers
by: advocate
communities: [security]
description: "Reporting a vulnerability requires special handling, each company has a different process, a security.txt file can help!"
tags: [securitytxt, security, vulnerabilities, github]
tweets:
- "Don't report security issues in a public bug tracker‼️"
- "Confused where to report a security issue? A security.txt file can help with that ℹ️"
- "Security.txt, a standardized way to define security policies 💻"
image: intro-security-txt/security-txt-social.png
type: awareness
---
We all know that all software has bugs and that security is hard, but somehow we are still surprised when we see new vulnerabilities.

Vulnerability:: A bug, flaw, weakness, or exposure of an application, system, device, or service that could lead to a failure of confidentiality, integrity, or availability.

In 2020, there were 18,395 vulnerabilities reported, which means about 50 new vulnerabilities are reported every day. These numbers only include what has been reported to MITRE's Common Vulnerability and Exposures (CVE) database, which means the actual value is likely much higher. Every year we add more software to the world, so these numbers will only increase. I didn't list this number here to scare you; more so, they are a fact of life, and we all need to be aware of how to deal with them.

## Reporting Vulnerabilities

Vulnerabilities are NOT handled the same way as a typical software bug. A _properly_ handled vulnerability is reported privately to the project's maintainers, then fixed and released before any information about the vulnerability is made public. It may seem like a good idea to report a security issue on GitHub Issues, but it isn't! Handling vulnerabilities privately may seem counter-intuitive, especially for open-source projects where everything is public, but this isn't just good manners, even more importantly it reduces potential exposure for everyone using the project.

Okay, so if not a public issue tracker, then where do you report the issue?

## Where do you report a vulnerability

The actual "where do you report a vulnerability" is where things get complicated; every project and company has a different process to handle vulnerabilities. Figuring out who to report an issue to is often an exercise in frustration; try to browse a website, do a Google search, maybe even look on bug bounty sites like [HackerOne](https://www.hackerone.com/) or [Bugcrowd](https://www.bugcrowd.com/). There is an easier way! Enter [`security.txt`](https://securitytxt.org/), a [draft RFC](https://datatracker.ietf.org/doc/html/draft-foudil-securitytxt-12), that aims to standardize a method for security policies to be discovered.

Defining a `security.txt` is easy. Create a small `.well-known/security.txt` file at the root of your domain containing your security team's contact information. There is even a form on [securitytxt.org](https://securitytxt.org/) that will generate one for you in a few seconds!

For example, Okta's https://www.okta.com/.well-known/security.txt is:

```txt
Contact: mailto:security@okta.com # <1>
Expires: 2023-01-01T05:00:00.000Z # <2>

# Optional Fields
Preferred-Languages: en # <3>
Policy: https://www.okta.com/vulnerability-reporting-policy/ # <4>
Hiring: https://www.okta.com/company/careers/ # <5>
```

1. How to contact the security team.
2. A date when to consider this data stale.
3. List of languages the security team prefers.
4. Link back to a reporting policy page with more details.
5. Even a link back to relevant job postings.

The contents of the `security.txt`, a quick summary of who to contact and where to go to find more information, is not a replacement for existing security policy pages. Still, it can contain additional information such as a company's PGP keys, acknowledgments, and canonical URL information.

> **NOTE:**
>
> If you are familiar with [OpenID Connect](/blog/2019/10/21/illustrated-guide-to-oauth-and-oidc), the `.well-known` part of the above URL may look familiar to you. "Well Known URIs" are defined by [RFC-8615](https://www.rfc-editor.org/rfc/rfc8615.html), and there is an official [IANA registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) containing a variety of entries, everything from Tor Relay information to IoT protocols. The goal of all of these individual "well-known" endpoints is to make it easy to discover metadata about a specific service.

## Bonus: Update your bug tracking templates

If we as developers were in the habit of reading documentation, RTFM wouldn't be a thing, or maybe we are just busy:

> In general, your users are trying to get something done, and they see reading the manual as a waste of time, or at the very least, as a distraction that keeps them from getting their task done.
>
> — Joel Spolsky, [joelonsoftware.com](https://www.joelonsoftware.com/2000/04/26/designing-for-people-who-have-better-things-to-do-with-their-lives/)

If your project uses a public bug tracker (like GitHub Issues), information about handling security issues needs to be obvious to the reporter. One way to do this is to define a [`SECURITY.md`](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository) file and create `ISSUE_TEMPLATE.md`; that way it's the first thing the reporter sees when the file an issue. For example, the Spring Security [issue template](https://raw.githubusercontent.com/spring-projects/spring-security/main/.github/ISSUE_TEMPLATE.md) starts with:

```md
<!--
For Security Vulnerabilities, please use https://pivotal.io/security#reporting
-->
```

> **TIP:** What makes this so clever is the HTML comment; only the reporter sees the comment when opening an issue. It doesn't get displayed when the Markdown is rendered!

## Learn more about application security

Most folks don't know that vulnerabilities require special handling; it isn't taught in a typical university computer science curriculum or coding bootcamp. Information about how to report security issues needs to be obvious and easily discoverable.

If you want to learn more about application security, check out these great posts:

- [How to Hack OAuth](https://www.youtube.com/watch?v=aU9RsE4fcRM)
- [Stealing OAuth Tokens With Open Redirects](https://sec.okta.com/articles/2021/02/stealing-oauth-tokens-open-redirects)
- [SQL Injection in PHP: Practices to Avoid](/blog/2020/06/15/sql-injection-in-php)

If you have questions, please leave a comment below. If you liked this post, follow [@oktadev](https://twitter.com/oktadev) on Twitter, follow us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
