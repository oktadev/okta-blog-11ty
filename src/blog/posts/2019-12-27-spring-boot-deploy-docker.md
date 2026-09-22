---
disqus_thread_id: 7774254183
discourse_topic_id: 17189
discourse_comment_url: https://devforum.okta.com/t/17189
title: "Add Docker to Your Spring Boot Application"
author: thiago-negri
by: contractor
communities: [java, devops]
description: "Tutorial: Learn how to package a Spring Boot application as a Docker container."
tags: [spring-boot, oauth, oidc, docker, deploy]
tweets:
- "Create a Docker container with a Spring Boot app with 4 lines of code!"
- "Learn how to package a @SpringBoot app with @Docker!"
- "A @SpringBoot app + @Docker == 💕☕"
image: featured/okta-java-short-tile-books-mouse.jpg
type: conversion
changelog:
- 2021-04-02: Updated to use Java 11 and Spring Boot 2.4.4. See [example app changes on GitHub](https://github.com/oktadeveloper/spring-boot-docker-example/pull/1). Changes to this article can be viewed in [okta-blog#674](https://github.com/oktadeveloper/okta-blog/pull/674).
---
Docker enables you to deploy a server environment in containers. A container is a standardized unit of software that assembles code, runtime, dependencies, settings, and initialization in a single package that you can run reliably from one computing environment to another. Deploying your app as a Docker container is not hard, and can alleviate a lot of problems that you may encounter when moving your app around the multiple environments it has to go, like development machines, QA environment, staging, and production.

{% img {src: "spring-boot-deploy-docker/app-docker-host.png", alt: "Docker host layer diagram", header: "400"} %}

In this tutorial, you'll see how to leverage Docker to deploy your Spring Boot application.

{% include "integrator-org-warning.njk" %}

[[toc]]

**Prerequisites:**

- Java 11+ - Install with [SDKMAN](https://sdkman.io/) or directly from [AdoptOpenJDK](https://adoptopenjdk.net/)
- Docker - I recommend [Docker Desktop](https://www.docker.com/products/docker-desktop)
- An [Okta account](https://developer.okta.com/signup) - More on that below

First, let's build a sample Spring Boot app to use.

## Create A Spring Boot App

You'll use [Spring Initializr](https://start.spring.io/) to generate your Spring Boot project with the help of [HTTPie](https://httpie.org/), a simple command-line HTTP client.

You may use the Spring Initializr website directly if you don't want to use the command line.

From the command line simply enter:

```txt
http https://start.spring.io/starter.zip bootVersion==2.4.4.RELEASE \
 dependencies==web,okta \
 groupId==com.okta.spring-docker.demo \
 packageName==com.okta.spring-docker.demo \
 --download
```

And then unzip the downloaded file.

```txt
unzip demo.zip -d spring-boot-docker
cd spring-boot-docker
```

You'll next add a web controller by creating file `src/main/java/com/okta/springdocker/demo/WebController.java`:

```java
package com.okta.springdocker.demo;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WebController {

    @RequestMapping("/")
    public String home() {
        return "Welcome!";
    }
}
```

You also need to configure the security settings for this project. For the moment, you'll want to allow all requests, so update your `DemoApplication.java` file to the following:

```java
package com.okta.springdocker.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }

    @Configuration
    static class OktaOAuth2WebSecurityConfigurerAdapter extends WebSecurityConfigurerAdapter {

        @Override
        protected void configure(HttpSecurity http) throws Exception {
            http.authorizeRequests().anyRequest().permitAll();
        }
    }
}
```

You may compile and run your app with:

```txt
./mvnw package
java -jar target/demo-0.0.1-SNAPSHOT.jar
```

Then if you hit `http://localhost:8080` you should see a "Welcome!" message.

## Run Your Spring Boot App as a Docker Container

To run your app as a Docker container, the very first step is to install [Docker](https://www.docker.com/products/docker-desktop).

After installing, it's time to build your container. For that, Docker uses a file that describes how to assemble the container, which is called a `Dockerfile`. The `Dockerfile` consists of step-by-step instructions to execute in a container.

> **TIP:** Reach out to [Dockerfile reference](https://docs.docker.com/engine/reference/builder/) for an explanation of all commands you can use.

For your Spring Boot app, you'll use a simple `Dockerfile` file:

```dockerfile
FROM openjdk:11 // <1>

COPY target/demo-0.0.1-SNAPSHOT.jar app.jar // <2>

EXPOSE 8080  // <3>

ENTRYPOINT ["java", "-jar", "/app.jar"] // <4>
```

1. You'll start your Dockerfile with a `FROM` declaration that defines a source container image to build upon. In this way you can leverage an existing container definition that contains JDK 11.
2. The second instruction is `COPY`. Here you are telling Docker to copy a local file into the container, in this case, your built application will be available in the container as `/app.jar`.
3. The `EXPOSE` part shows you that the app will listen on port 8080. Although it is not required to make the Docker container work properly, it acts as documentation for future readers.
4. The last command, `ENTRYPOINT`, tells Docker what it should execute when you run that container. As you are building a Spring Boot application, this is a simple `java -jar` of your app.

> **TIP:** You can browse through a lot of community containers to use as a base at [DockerHub](https://hub.docker.com/).

Now you can build the container on your command line. Execute the following while replacing `okta:spring_boot_docker` with a **tag** of your liking, it will serve as a name to reference the container you are building:

```text
docker build . -t okta:spring_boot_docker
```

If all went well, you may now run your Dockerized app (using the same **tag** as you used before):

```text
docker run --publish=8080:8080 okta:spring_boot_docker
```

To stop the container, hit **CTRL-C**. Verify the container isn't running, execute:

```text
docker ps
```

This will list all the containers running on your machine. If your Spring Boot app is still running, you can terminate the container with (use the **Container ID** printed by `docker ps`):

```text
docker kill <CONTAINER_ID>
```

As your JAR file is copied into the container when you build it, you will need to rebuild your container each time you want to use a newer version of the app. So the cycle would be:

1. Change your code
2. Build the app `./mvnw package`
3. Build the container `docker build . -t okta:spring_boot_docker`
4. Run the container `docker run --publish=8080:8080 okta:spring_boot_docker`
5. Stop the container
6. Loop

Now you know the basics of using Docker containers to run your app! In the future, you can publish your built container into Docker registries (like DockerHub), so others can fetch the container and it'll be ready to run.

Next, we will secure the app with Okta and understand how we can pass sensitive data to the container.

## Secure Your Spring Boot and Docker App

{{ macro.cli({type: "web", adoc: "true", framework: "Okta Spring Boot Starter"}) }}

Change the `DemoApplication` class, replacing `.authorizeRequests().anyRequest().permitAll()` with `.authorizeRequests().anyRequest().authenticated()`. This will tell Spring that all the endpoints of your app will require an authenticated user.

```java
@Override
protected void configure(HttpSecurity http) throws Exception {
    http.authorizeRequests().anyRequest().authenticated();
}
```

Let's give it a try!

First compile and build your container.

```text
./mvnw package
```

Then build the container:

```text
docker build . -t okta:spring_boot_docker
```

The Okta CLI added your Okta settings to `src/main/resources/application.properties`. However, you might want to check this file into source control. Therefore, it's a good idea to remove the `okta.oauth2.*` properties from this file and use environment variables instead.

To pass Okta info to the container as environment variables, you can use the `-e` command line parameter. Like so:

```text
docker run --publish=8080:8080 \
 -e OKTA_OAUTH2_ISSUER=<org_url>/oauth2/default \
 -e OKTA_OAUTH2_CLIENT_ID=<client_id> \
 -e OKTA_OAUTH2_CLIENT_SECRET=<client_secret> \
 okta:spring_boot_docker
```

Now if you hit `http://localhost:8080` you will see a login form, and after providing your username and password you should be able to see the welcome page again. A dependency and a couple of properties are all it takes to secure your application with OIDC/OAuth 2.0!

## Learn More About Spring, Docker, and Security!

In this tutorial, you learned how to build a Docker container for your Spring Boot app by writing the Dockerfile manually. There's also a Maven plugin that can prepare the container for you. It's called Jib and we cover it in more detail at [Get Jibby With Java, Docker, and Spring Boot](/blog/2019/08/09/jib-docker-spring-boot). Finally, Spring Boot 2.3 added built-in support for building Docker containers. Learn more in [How to Docker with Spring Boot](/blog/2020/12/28/spring-boot-docker).

Other than that, we have more resources for you to continue learning about Java, Docker, Deployment, and OAuth 2.0:

- [A Developer's Guide To Docker - A Gentle Introduction](/blog/2017/05/10/developers-guide-to-docker-part-1)
- [Which Java SDK Should You Use?](/blog/2019/01/16/which-java-sdk)
- [Java + Spring Tutorials](/blog/2019/05/24/java-spring-tutorials)
- [Build a Web App with Spring Boot and Spring Security in 15 Minutes](/blog/2018/09/26/build-a-spring-boot-webapp)

The source code for this post is available on [GitHub](https://github.com/oktadeveloper/spring-boot-docker-example).

If you have any questions about this post, please add a comment below. For more awesome content, follow [@oktadev](https://twitter.com/oktadev) on Twitter, like us [on Facebook](https://www.facebook.com/oktadevelopers/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
