---
disqus_thread_id: 7072923448
discourse_topic_id: 16960
discourse_comment_url: https://devforum.okta.com/t/16960
title: "Spring Boot 2.1: Outstanding OIDC, OAuth 2.0, and Reactive API Support"
author: matt-raible
by: advocate
communities: [java, javascript]
description: "In this guide, you'll learn about new features in Spring Boot 2.1. You'll also learn about Spring Security, its excellent OIDC / OAuth 2.0 support, and how to develop a reactive API with WebFlux."
tags: [spring-boot, spring-boot-2, spring-framework, spring-security, oidc, oauth2, reactive, webflux]
tweets:
- "Spring Boot 2.1: Outstanding OIDC, OAuth 2.0, and Reactive API support > "
- "We 💚 @springboot here at @okta. Learn about its new features and refinements in this handy blog post."
- "Learn how to use Spring Boot 2.1 with @angular, @reactjs, and @webflux in this action-packed article!"
image: featured/okta-java-skew.jpg
type: conversion
changelog:
  - 2018-12-19: Updated to use Okta Spring Boot Starter 1.0.0. You can see the changes to this post in [okta.github.io#2590](https://github.com/oktadeveloper/okta.github.io/pull/2590).
---
Spring Boot 2.1 was recently released, eight months after the huge launch of Spring Boot 2.0. The reason I'm most excited about Spring Boot 2.1 to me is its improved performance and OpenID Connect (OIDC) support from Spring Security 5.1. The combination of Spring Boot and Spring Security has provided excellent OAuth 2.0 support for years, and making OIDC a first-class citizen simplifies its configuration quite a bit.

For those that aren't aware, OIDC is just a thin-layer on top of OAuth 2.0 that provides the user's identity with an ID token. Spring Security automatically translates this token into a Java `Principal` so you can easily retrieve a user's information using dependency injection. In addition to an ID token, OIDC adds:

- A UserInfo endpoint for getting more user information
- A standard set of scopes
- A standardized implementation of the ID token (with JWT)

{% img {src: "spring-boot-2.1/oauth2-and-oidc.png", alt: "OAuth 2.0 and OpenID Connect", header: "600"} %}

Before I dive into showing you how to add authentication to a Spring Boot app with OIDC, let's take a look at what's new and noteworthy in this release.

<a id="whats-new-in-spring-boot-2-1"></a>
## What's New in Spring Boot 2.1

I think [Philip Riecks](https://twitter.com/rieckpil) does a great job of summarizing the highlights in [What's new in Spring Boot 2.1](https://rieckpil.de/review-whats-new-in-spring-boot-2-1/):

- **Java 11 Support**: just add `<java.version>11</java.version>` to your `pom.xml`!
- **Logging Groups**: group logging categories using `logging.group.{groupName}={first},{second}` (`logging.group.web` and `logging.group.sql` are already defined).
- **Lazy JPA startup**: specify `spring.data.jpa.repositories.bootstrap-mode=lazy` to turn it on.
- **JUnit 5 improvements**: no more `@ExtendWith(SpringExtension.class)` necessary!

There are some other useful security-related features in the [official Spring Boot 2.1 release notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-2.1-Release-Notes):

- `@WebMvcTest` and `@WebFluxTest` security configuration is now automatically included with web slice tests. `@WebMvcTest` looks for a `WebSecurityConfigurer` bean while `@WebFluxTest` looks for a `ServerHttpSecurity` bean.
- OAuth 2.0 client configuration has a single `spring.security.oauth2.client.registration` tree. The `authorizationcode` and `clientcredentials` keys have been removed.
- Thymeleaf Spring Security Extras has changed its auto-configuration coordinates to `thymeleaf-extras-springsecurity5`. Update your build files!
- OAuth 2.0 login has been added to WebFlux, along with resource server support. _I like to call it **OIDC login** since [OAuth is not for authentication](https://www.youtube.com/watch?v=iGFy1xHGGx4)._

Another new feature that looks interesting: Elasticsearch REST client support. I integrated [Spring Data Jest](https://github.com/VanRoy/spring-data-jest) into JHipster, so this development intrigues me. Especially its description: an alternative option to [Jest](https://github.com/searchbox-io/Jest), auto-configurations for `RestClient` and `RestHighLevelClient` are provided with configurable options from the `spring.elasticsearch.rest.*` namespace.

## Create a Secure Spring Boot Application

You can create a Spring Boot application quickly with the Spring CLI. It allows you to write Groovy scripts that get rid of the boilerplate Java and build file configuration. Refer to the [project's documentation for installation instructions](https://docs.spring.io/spring-boot/docs/current/reference/html/getting-started-installing-spring-boot.html#getting-started-installing-the-cli). To install Spring CLI, I recommend using [SDKMAN!](https://docs.spring.io/spring-boot/docs/current/reference/html/getting-started-installing-spring-boot.html#getting-started-sdkman-cli-installation):

```bash
sdk install springboot
```

Or you can use [Homebrew](https://docs.spring.io/spring-boot/docs/current/reference/html/getting-started-installing-spring-boot.html#getting-started-homebrew-cli-installation) if you're on a Mac.

```bash
brew tap pivotal/tap
brew install springboot
```

Make sure you're using the 2.1.0 version by running `spring --version`.

```bash
$ spring --version
Spring CLI v2.1.0.RELEASE
```

Create a `hello.groovy` file that has the following code:

```groovy
@Grab('spring-boot-starter-security')
@RestController
class Application {

  @RequestMapping('/')
  String home() {
    'Hello World'
  }
}
```

The `@Grab` annotation invokes [Grape](http://docs.groovy-lang.org/latest/html/documentation/grape.html) to download dependencies. Because Spring Security is in the classpath, its default security rules will be used. That is, protect everything, allow a user with the username `user`, and generate a random password on startup for that user.

Run this app with the following command:

```bash
spring run hello.groovy
```

Open your browser to `http://localhost:8080` and you'll be greeted with a login form. Enter `user` for the username and copy/paste the generated password from your terminal. If you copied and pasted the password successfully, you'll see `Hello World` in your browser.

## Add Identity and Authentication with OIDC

Using the same username and password for all your users is silly. Since friends don't let friends write authentication, I'll show you how to use Okta for auth with just a few lines of code.

OIDC requires an identity provider (or IdP). There are many well-known IdPs like Google, Twitter, and Facebook, but those services don't allow you to manage your users like you would in Active Directory. Okta allows this, _and_ you can use Okta's API for OIDC.

[Register for a forever-free developer account](https://developer.okta.com/signup/), and when you're done, come on back so you can learn more about how to secure your Spring Boot app!

{% img {src: "spring-boot-2.1/okta-signup.png", alt: "Register for a free developer account", header: "800"} %}

### Create an OIDC App in Okta

Log in to your Okta Developer account and navigate to **Applications** > **Add Application**. Click **Web** and click **Next**. Give the app a name you'll remember, and specify `http://localhost:8080/login/oauth2/code/okta` as a Login redirect URI. Click **Done**. The result should look something like the screenshot below.

{% img {src: "spring-boot-2.1/okta-oidc-app.png", alt: "Okta OIDC App", header: "700"} %}

Copy and paste the URI of your default authorization server, client ID, and the client secret into `application.yml` (you'll need to create this file).

```yaml
spring:
  security:
    oauth2:
      client:
        provider:
          okta:
            issuer-uri: https://{yourOktaDomain}/oauth2/default
        registration:
          okta:
            client-id: {clientId}
            client-secret: {clientSecret}
```

> **TIP:** The `{}` brackets are just placeholders to show variables, you'll want to remove these so they don't surround your app's values.

Create a `helloOIDC.groovy` file that uses Spring Security and its OIDC support.

```groovy
@Grab('spring-boot-starter-oauth2-client')

@RestController
class Application {

  @GetMapping('/')
  String home(java.security.Principal user) {
    'Hello ' + user.name
  }
}
```

Run this file using `spring run helloOIDC.groovy` and try to access `http://localhost:8080`. You'll be redirected to Okta to log in, or just shown `Hello {sub claim}` if you're already logged in.

You can also use [Okta's Spring Boot starter](https://github.com/okta/okta-spring-boot) and make it even simpler:

**application.yml**

```yaml
okta:
  oauth2:
    issuer: https://{yourOktaDomain}/oauth2/default
    client-id: {clientId}
    client-secret: {clientSecret}
```

**helloOkta.groovy**

```groovy
@Grab('com.okta.spring:okta-spring-boot-starter:1.0.0')

@RestController
class Application {

  @GetMapping('/')
  String home(java.security.Principal user) {
    'Hello ' + user.name
  }
}
```

## Limiting Access Based on Group

Spring Security ships with a number of nifty annotations that allow you to control access to methods. You can use `@Secured`, `@RoleAllowed`, and `@PreAuthorize` to name a few. To enable method-level security, you just need to add the following annotation to a configuration class.

<div class="example">

Example 1. Spring Security Method-Level Security {.example-title}

```java
@Configuration
@EnableGlobalMethodSecurity(
  prePostEnabled = true, // <1>
  securedEnabled = true, // <2>
  jsr250Enabled = true) // <3>
public class SecurityConfig {
}
```

1. `prePostEnabled` enables Spring Security's `@PreAuthorize` and `@PostAuthorize` annotations
2. `secureEnabled` controls the `@Secured` annotation
3. `jsr250Enabled` toggles the `@RoleAllowed` annotation
{.colist}

</div>

To use these annotations in your app, you'll need to add a "groups" claim to your ID token.  Log in to your Okta account, navigate to **API** > **Authorization Servers**, click the **Authorization Servers** tab and edit the default one. Click the **Claims** tab and **Add Claim**. Name it "groups", and include it in the ID Token. Set the value type to "Groups" and set the filter to be a Regex of `.*`.

Now Spring Security will recognize your groups as authorities and allow you to lock down methods!

**hello.groovy**

```groovy
@Grab('com.okta.spring:okta-spring-boot-starter:1.0.0')

import org.springframework.security.access.prepost.PreAuthorize

@EnableGlobalMethodSecurity(prePostEnabled = true)
@RestController
class Application {

  @GetMapping('/')
  String home(java.security.Principal user) {
    'Hello ' + user.name
  }

  @GetMapping('/admin')
  @PreAuthorize("hasAuthority('Administrators')")
  String admin(java.security.Principal user) {
    'Hello, ' + user.name + '. Would you like to play a game?'
  }
}
```

> **TIP:** Learn more about Spring method security from [Baeldung](https://www.baeldung.com/spring-security-method-security).

<a id="angular-react-and-webflux-oh-my"></a>
## Angular, React, and WebFlux - Oh My!

I updated a few of my favorite tutorials on this blog to use Spring Boot 2.1 recently.

- [Build a Basic CRUD App with Angular 7.0 and Spring Boot 2.1](/blog/2018/08/22/basic-crud-angular-7-and-spring-boot-2): uses implicit flow, Okta's Angular SDK, and a Spring Security resource server.
- [Use React and Spring Boot to Build a Simple CRUD App](/blog/2018/07/19/simple-crud-react-and-spring-boot): uses authorization code flow and packages everything in a single JAR.
- [Full Stack Reactive with Spring WebFlux, WebSockets, and React](/blog/2018/09/25/spring-webflux-websockets-react): uses implicit flow, along with Spring Security OIDC login and resource server.

I enjoyed writing the full stack reactive tutorial so much, I turned it into a screencast! _A keen eye will notice I'm using Java 11 **and** Node 11 in this video._ 😃

<div style="text-align: center">
<iframe width="560" height="315" style="max-width: 100%" src="https://www.youtube.com/embed/1xpwYe154Ys" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

<a id="jhipster-and-spring-boot-2-1"></a>
## JHipster and Spring Boot 2.1

Earlier I mentioned [JHipster](https://www.jhipster.tech). The JHipster team is actively working on upgrading its baseline to Spring Boot 2.1. You can watch progress by following [issue #8683](https://github.com/jhipster/generator-jhipster/issues/8683).

If you've never heard of JHipster before, you should download the [free JHipster Mini-Book](https://www.infoq.com/minibooks/jhipster-mini-book-5) from InfoQ! It's a book I wrote to help you get started with hip technologies today: Angular, Bootstrap and Spring Boot. The 5.0 version was [just released](http://www.jhipster-book.com/#!/news/entry/jhipster-mini-book-v5-now-available).

## Learn More About Spring Boot and Spring Security

I've only touched on the tip of the iceberg regarding the capabilities of Spring Boot and Spring Security. You can use them to [build and secure microservices](/blog/2018/02/13/secure-spring-microservices-with-oauth) too!

Below are some related posts that show the power of using OAuth 2.0 and OIDC to secure your Spring Boot APIs.

- [Simple Token Authentication for Java Apps](/blog/2018/10/16/token-auth-for-java)
- [Build a Web App with Spring Boot and Spring Security in 15 Minutes](/blog/2018/09/26/build-a-spring-boot-webapp)
- [Secure Server-to-Server Communication with Spring Boot and OAuth 2.0](/blog/2018/04/02/client-creds-with-spring-boot)
- [Build a Simple CRUD App with Spring Boot and Vue.js](/blog/2018/11/20/build-crud-spring-and-vue)

If you enjoyed this post, follow us on social media { [Twitter](https://twitter.com/oktadev), [Facebook](https://www.facebook.com/oktadevelopers), [LinkedIn](https://www.linkedin.com/company/oktadev/), [YouTube](https://www.youtube.com/channel/UC5AMiWqFVFxF1q9Ya1FuZ_Q) } to know when we've posted ones like it.
