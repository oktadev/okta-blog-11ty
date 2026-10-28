---
disqus_thread_id: 8289323588
discourse_topic_id: 17323
discourse_comment_url: https://devforum.okta.com/t/17323
title: "Spring Boot and Okta in 2 Minutes"
author: matt-raible
by: advocate
communities: [java]
description: "This 2-minute video shows you how to use the Okta CLI to secure your Spring Boot app in seconds."
tags: [java, spring-boot, okta, okta-cli]
tweets:
- "Want to be a secure @java developer in just 2 minutes. Me too! Learn how 👉"
- "The Okta CLI makes it possible to create an account, download a @springboot sample, and configure it in seconds!"
- "We 💙 the Okta CLI here at @oktadev. This screencast shows how to use it with @springboot."
image: okta-cli-spring-boot/okta-cli-loves-spring-boot.png
type: conversion
changelog:
- 2022-01-25: Updated to use `.okta.env` instead of `application.properties`. This change is necessary since the okta-spring-boot-sample now uses [dotenv to load Okta settings](https://github.com/okta-samples/okta-spring-boot-sample/pull/22). Changes to this post can be viewed in [okta-blog#1048](https://github.com/oktadev/okta-blog/pull/1048).
---
The Okta CLI is a new tool we've created here at Okta. It's designed to streamline the process of creating new Okta accounts, registering apps, and getting started. Wwwhhaaattt, you might say?! That's right, it's super awesome!

To show you how much fun it is, I [created a screencast that shows you how to use it](https://youtu.be/dURkaz0kBSU).

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" style="max-width: 100%" src="https://www.youtube.com/embed/dURkaz0kBSU" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

> **NOTE:** This video puts your settings in `src/main/resources/application.properties`. We've since changed the default behavior to use [spring-dotenv](https://github.com/okta-samples/okta-spring-boot-sample/pull/22).

For those that would rather read than watch, please read on.

## Install the Okta CLI

You can find the website for the Okta CLI at [cli.okta.com](https://cli.okta.com/). This site has instructions on how to use common package managers on macOS, Windows, and Linux. You can also use cURL:

```shell
curl https://raw.githubusercontent.com/okta/okta-cli/master/cli/src/main/scripts/install.sh | bash
```

Once you have the Okta CLI installed, you'll need [Java 11 installed](https://adoptopenjdk.net/) to run your Spring Boot app.

## Create a Spring Boot App

To create a secure Spring Boot app with Okta, run `okta start spring-boot`. You'll need to verify your email and set a password as part of this.

> **TIP:** If you already have an Okta account, you can run `okta login` first.

This will download our [Okta Spring Boot sample](https://github.com/okta-samples/okta-spring-boot-sample), register your app on Okta, and configure it by adding your Okta settings to a `.okta.env` file.

> **IMPORTANT:**
>
> Keep your secrets out of source control by adding `okta.env` to your `.gitignore` file:
>
> ```shell
> echo .okta.env >> .gitignore
> ```

Follow the instructions that are printed out for you. To summarize:

```shell
cd spring-boot
./mvnw spring-boot:run
```

Next, open your browser to `http://localhost:8080`. You'll likely be logged in straight away and see your name printed on the screen.

{% img {src: "okta-cli-spring-boot/hello-matt.png", alt: "Hello Matt", header: "800"} %}

If you use another browser, or an incognito window, you'll be prompted to sign in first.

{% img {src: "okta-cli-spring-boot/okta-login.png", alt: "Okta Login", header: "800"} %}

If you open `src/main/java/com/example/sample/Application.java`, you'll see the Java code that's used to render your name. You might appreciate how Spring Security makes authentication with OpenID Connect easy.

```java
@RestController
static class SimpleRestController {
    @GetMapping("/")
    String sayHello(@AuthenticationPrincipal OidcUser oidcUser) {
        return "Hello: " + oidcUser.getFullName();
    }
}
```

## Learn More about Spring Boot and Okta

I hope you've enjoyed this brief intro to the Okta CLI. It's a tool for developers to make their lives easier. If you have any suggestions for improvement, please add an issue to our [okta/okta-cli](https://github.com/okta/okta-cli) repository.

If you like Spring Boot and Okta, you might like these posts:

- [Deploy a Secure Spring Boot App to Heroku](/blog/2020/08/31/spring-boot-heroku)
- [OAuth 2.0 Patterns with Spring Cloud Gateway](/blog/2020/08/14/spring-gateway-patterns)
- [OpenID Connect Logout Options with Spring Boot](/blog/2020/03/27/spring-oidc-logout-options)
- [Build a CRUD App with Angular 9 and Spring Boot 2.2](/blog/2020/01/06/crud-angular-9-spring-boot-2)
- [OAuth 2.0 Java Guide: Secure Your App in 5 Minutes](/blog/2019/10/30/java-oauth2)

Be sure to follow us **@oktadev** on [Twitter](https://twitter.com/oktadev), [YouTube](https://youtube.com/oktadev) and [Twitch](https://www.twitch.tv/oktadev). We're accustomed to publishing fantastic content!
