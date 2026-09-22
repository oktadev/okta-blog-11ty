---
disqus_thread_id: 8776114621
discourse_topic_id: 17414
discourse_comment_url: https://devforum.okta.com/t/17414
title: "Session Clustering for OAuth 2.0 Applications"
author: brian-demers
by: advocate
communities: [java]
description: "Learn how sessions are used with OAuth 2.0 and build an example with HAproxy, Redis, and Spring Boot."
tags:  [spring-session, spring, microservices, java, spring-boot, haproxy, oauth2, oidc, session]
tweets:
- "Apps using OIDC/OAuth 2.0 don't have 'special' sessions requirements, but you still need to think about them 🧠"
- "Confused how #OAuth2 and OIDC affect your web app's sessions? Learn more and build an example with #Redis, #HAproxy, and #SpringBoot 💡"
- "Scaling an app from 1 to N means you need to think about load balancing, session management, and how those relate to Auth🔒"
image: oauth-sessions-with-java/social.png
type: conversion
---
A common OAuth 2.0 question we get: "How do I deal with OAuth in a load-balanced application?" The short answer: There's nothing specific about session clustering for OAuth. The longer answer is—you likely still need to worry about cluster session management. This post will discuss how an OAuth login relates to your application's session. And we'll build a simple, secure, load-balanced application to demonstrate.

{% include "integrator-org-warning.njk" %}

[[toc]]

**Prerequisites**

- [Docker 20.10+](https://docs.docker.com/get-docker/)
- [Java 11+](https://adoptopenjdk.net/?variant=openjdk11), use [SDKMAN](https://sdkman.io/) to manage multiple Java versions!
- [HTTPie](https://httpie.io/download), a user-friendly HTTP CLI
- [Okta CLI](https://cli.okta.com/)

## Sessions and OAuth 2.0 Applications

An application that uses an OAuth 2.0 redirect, an ["Authorization Code Grant"](https://oauth.net/2/grant-types/authorization-code/), typically uses a server-side session to temporarily store the state of the login process until it completes. Let's look at a simplified OAuth login flow:

{% img {src: "oauth-sessions-with-java/oauth-code-flow.png", alt: "Login Flow Sequence Diagram", header: "800"} %}

1. A user requests to log in - either by clicking on a login button or automatically when they request a protected page.
2. Web App stores information about the current session - OAuth state info and optionally a PKCE code verifier and/or a nonce for OpenId Connect (OIDC).
3. The response is a browser redirect to the authorization server.
4. User interacts with the authorization server to provide credentials and confirm consent.
5. Authorization server issues redirect with a code back to the web app.
6. User authorization is finalized on the backend.
7. The web app reads the previously stored OAuth data from the session.
8. Verification that the user has been authorized with the authorization server.
9. Auth Server response with an OAuth access token.
10. Web app stores access token in session.
11. User is logged in.

Two separate requests are made to the web application: the initial login request and a verification step. Both requests access the same session information. For your application, this means once you start scaling, you need to think about session management.

## Stateless with JWTs

At this point, you might wonder if you can cram everything in a JWT (JSON Web Token) and make this process stateless; removing the need for any session clustering. You _could_, but you would need to use a JWE (JSON Web Encryption) to ensure the browser didn't have access to any sensitive data. There are a whole host of reasons [not to use JWTs as session tokens](/blog/2017/08/17/why-jwts-suck-as-session-tokens), but those issues are outside the scope of this post.

## Load Balancer Sticky Sessions

Another option to avoid session replication or clustering is to use "sticky sessions" (or "session affinity"), but this creates a fragile environment. If a web server fails or is taken down for any reason, all users associated with that server would essentially be logged out. Sticky sessions also violate the [12-factor principles of process statelessness](https://12factor.net/processes).

> **IMPORTANT:** Don't confuse 12 Factor's reference to "process statelessness" with what's meant by "stateless" in the previous section. There we refer specifically to the need for an application relay on the "state" of a server between requests, for example data cached in memory or a file. Instead, a [backing service](https://12factor.net/backing-services) should be used. In the case of session storage, the example of Redis is used, which is exactly what we're going to do in the next section.

## Setup HAproxy and Redis

To build a load-balanced application, we need a minimum of three things—a load balancer (HAproxy), shared session storage (Redis), and multiple instances of a web application (Spring Boot).

If you want to skip right to the code, take a look at this [GitHub](https://github.com/oktadev/okta-spring-sessions-example) repo.

Create a new directory for this project:

```sh
mkdir oauth-sessions
cd oauth-sessions
```

### Configure HAproxy

HAproxy is used to distribute requests between multiple `backend` applications and create a configuration file, `haproxy.cfg`, that will serve two different web apps (one on port `8081`, and another on `8082`).

```config
global
    daemon
    maxconn 2000

    # send request logs to stdout, to make debugging easier
    log stdout format raw local0

defaults
    mode http
    log global
    option httplog
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend http-in
    bind *:8080
    default_backend webapps

backend webapps
    balance roundrobin

    # `host.docker.internal` refers to host that is running Docker Desktop
    # On Linux add `--add-host=host.docker.internal:host-gateway` to `docker run` to
    # mimic the functionality
    server webapp1 host.docker.internal:8081
    server webapp2 host.docker.internal:8082

```

> **TIP:** Make sure there is a trailing newline, or you may have trouble starting up HAproxy.

### Start HAproxy and Redis with Docker

I'll be running the example web application directly on my laptop, but HAproxy and Redis can both run as Docker containers. Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:

  haproxy:
    image: docker.io/haproxy:2.4-alpine
    volumes:
      - ./haproxy/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg
    extra_hosts:
      # Docker Desktop uses `host.docker.internal` for the host,
      # mimic this for linux installs, requires Docker 20.10+
      - host.docker.internal:host-gateway
    ports:
      - 8080:8080

  redis:
    # Starts Redis without persistence
    image: docker.io/redis:6.2.5-alpine
    ports:
      - 6379:6379
```

Start both HAproxy and Redis by running:

```sh
docker compose up
```

> **NOTE:** You can stop the process by pressing <kbd>Ctrl</kbd>+<kbd>C</kbd> or running the `docker compose down` command from the same directory.

## Build a Secure Spring Boot Application

Now that the system dependencies are out of the way, let's move on to building a Spring Boot application.

Create a new Spring Boot application by visiting [start.spring.io](https://start.spring.io) and selecting the **Web** and **Okta** dependencies or by running the following command:

```sh
https start.spring.io/starter.tgz \
  bootVersion==2.5.4 \
  dependencies==web,okta \
  groupId==com.example \
  artifactId==webapp \
  name=="Web Application" \
  description=="Demo Web Application" \
  packageName==com.example \
  javaVersion==11 \
| tar -xzvf -
```

To give a visual indication of which server handled the request, create a REST controller that displays the server port in `src/main/java/com/example/Endpoints.java`:

```java
package com.example;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class Endpoints {

    @GetMapping("/")
    String serverInfo(@Value("${server.port}") int port) {
        return "Hello, your server port is: " + port;
    }
}
```

### Start the Spring Boot Application

In the previous section, HAproxy was bound to port `8080`, which is also the default port for Spring Boot. Start the application on port `8081` using:

```sh
SERVER_PORT=8081 ./mvnw spring-boot:run
```

At this point, the Spring Boot application has NOT been configured to use Redis or OAuth, but you can still test out the server by grabbing the auto-generated password from the console output. It will look something like this:

```txt
Using generated security password: 4302a714-580b-4d01-91d9-5d9597ee1bb5
```

Copy the password and make a request to the Spring Boot application:

```sh
http :8081/ --auth user:<your-password>
```

You will see a response containing the server port:

```txt
Hello, your server port is: 8081
```

Great, this means that the Spring Boot application is up and running! Now make sure you can access the server through the load balancer on port `8080`:

```sh
http :8080/ --auth user:<your-password>
```

You should see the same response; if you see a `503 Service Unavailable`, try the request one more time.

> **IMPORTANT:** The HAproxy configuration used in this post does NOT have health checks enabled, so it will alternate requests between port `8081` and `8082`; this is intentional to simplify the configuration. Take a look at [Spring Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html) if you want to add health checks and other monitoring to your application.

Stop the Spring Boot server using `Ctrl`+`C`. It's time to secure the application with OAuth 2.0.

## Secure Spring Boot with OAuth 2.0

{{ macro.cli({type: "web", framework: "Okta Spring Boot Starter"}) }}

Now that the application has been configured to use OAuth 2.0, start two different instances (open two different terminal windows):

```sh
SERVER_PORT=8081 ./mvnw spring-boot:run
```

And the second one on port `8082`:

```sh
SERVER_PORT=8082 ./mvnw spring-boot:run
```

Accessing the applications through the load balancer will yield odd results; open a private/incognito window to `http://localhost:8080` and try to log in. You will be redirected to Okta where you can type in your account credentials. However, after pressing the **Sign In**, you will see an error page:

{% img {src: "oauth-sessions-with-java/oauth-login-failure.png", alt: "Invalid credentials authentication error shown in the browser", header: "800"} %}

Think back to the sequence diagram at the beginning of this post, and see if you can spot the problem. The initial login request (step one) happened on one instance, and the final one occurred on another (step six). Updating the application to use shared session storage will fix the problem.

Let's do that!

## Share Sessions with Redis

If you are following along, you already have a Redis server running; now we'll configure the Spring Boot application to make use of it. Luckily, [Spring Session](https://spring.io/projects/spring-session) makes the process painless.

Open up the `pom.xml` and add the following inside the `<dependencies>` block:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

> **WARNING:** By default, Spring Session configures Redis to connect to `localhost` on port `6379` and NO password. Take a look at the [Spring Session documentation](https://docs.spring.io/spring-session/docs/current/reference/html5/guides/boot-redis.html#boot-redis-configuration) for various configuration options.

Restart the Spring Boot applications. (Remember there's one on port `8081` and another on `8082`).

Open up your browser again and try to access `http://localhost:8080/`; this time, you will be able to log in without issue!

Refresh the browser a few times and you will see the response alternating between the ports:

```txt
Hello, your server port is: 8081
```

And:

```txt
Hello, your server port is: 8082
```

Easy enough, just a couple of dependencies to configure shared session storage! If Redis isn't your jam, Spring Session also supports [databases](/blog/2020/10/02/spring-session-mysql), [Hazelcast](https://spring.io/projects/spring-session-hazelcast), [MongoDB](https://spring.io/projects/spring-session-data-mongodb), and [Apache Geode](https://spring.io/projects/spring-session-data-geode).

## Learn More OAuth 2.0 and Session Management

This post shows how to manage sessions for a simple load-balanced application that uses OAuth 2.0. Our example focused on the Spring Boot portion of the application, but it's far from production-ready. A few other concerns would need to be addressed first:

- A single HAproxy and Redis instance are single points of failure
- Redis data is not persisted
- Redis connections are not secured
- TLS should be enabled for [HAproxy](https://www.haproxy.com/blog/haproxy-ssl-termination/) and the [Spring Boot application](/blog/2018/07/30/10-ways-to-secure-spring-boot)

If you want to learn more, check out this related content:

- [10 Excellent Ways to Secure Your Spring Boot Application](/blog/2018/07/30/10-ways-to-secure-spring-boot)
- [Why JWTs Suck as Session Tokens](/blog/2017/08/17/why-jwts-suck-as-session-tokens)
- [Easy Session Sharing in Spring Boot with Spring Session and MySQL](/blog/2020/10/02/spring-session-mysql)
- [OAuth 2.0 Patterns with Spring Cloud Gateway](/blog/2020/08/14/spring-gateway-patterns)
- [Secure Secrets With Spring Cloud Config and Vault](/blog/2020/05/04/spring-vault)

If you have questions, please leave a comment below. If you liked this tutorial, follow [@oktadev](https://twitter.com/oktadev) on Twitter, follow us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
