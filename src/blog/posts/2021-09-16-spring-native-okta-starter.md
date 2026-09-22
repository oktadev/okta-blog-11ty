---
disqus_thread_id: 8774700505
discourse_topic_id: 17413
discourse_comment_url: https://devforum.okta.com/t/17413
title: "Spring Native in Action with the Okta Spring Boot Starter"
author: matt-raible
by: advocate
communities: [java]
description: "Spring Native makes Spring Boot apps into native images. Learn how we made the Spring Boot starter work with it."
tags: [spring, spring-boot, spring-native, java]
tweets:
- "Watch @starbuxman, @briandemers, and @mraible figure out how to add Spring Native support to the Okta Spring Boot starter."
- 'Want to go native with the Okta Spring Boot starter? Just add @‌NativeHint(options = "--enable-https") to your main Application class!'
- "Use Spring Native to create an app with @springboot + @okta. It's pretty slick!"
image: spring-native-okta-starter/spring-native-okta.png
type: conversion
changelog:
- 2022-01-25: Updated to use `.okta.env` instead of `application.properties`. This change is necessary since the okta-spring-boot-sample now uses [dotenv to load Okta settings](https://github.com/okta-samples/okta-spring-boot-sample/pull/22). Changes to this post can be viewed in [okta-blog#1049](https://github.com/oktadev/okta-blog/pull/1049).
---
In the fall of 2020, the Spring team released a new experimental Spring Native project that gave Spring developers hope for faster startup times. Spring Native is all about converting your Spring applications to native executables. It leverages GraalVM to make it happen. This announcement was huge because the new kids on the block, Micronaut and Quarkus, produced native executables by default.

I was really excited about Spring Native when I first heard about it. Its first release (v0.8.3) was on Nov 23, 2020, but I started playing with it in September 2020, probably due to SpringOne. How do I know this? Because that's when I first tried it, and [entered an issue for the Okta Spring Boot starter](https://github.com/okta/okta-spring-boot/issues/192). I was able to get things working with Spring Security's OAuth dependencies (instead of the Okta starter) in the waning weeks of 2020.

[[toc]]

## Branching out with Spring Native

According to VMWare Tanzu's recent [State of Spring 2021 report](https://tanzu.vmware.com/content/ebooks/the-state-of-spring-2021), a lot of people know about Spring Native, but it's still early.

{% img {src: "spring-native-okta-starter/state-of-spring-slide.png", alt: "State of Spring Slide", header: "800"} %}

I wrote about [how to build native Java apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison) earlier this summer and included my learnings. Around the same time, I thought to myself, "it'd sure be nice if the Okta Spring Boot starter worked with Spring Native."

To solve this desire, I scheduled a Twitch stream with [Brian Demers](/blog/authors/brian-demers) and [Josh Long](https://joshlong.com/). We spent 90+ minutes figuring things out. You can watch our struggles, collaborations, and ultimate joy in the [video below](https://youtu.be/8vY-9tXlCW4). I added a detailed table of contents to the video's description on YouTube, so you can skip around if you like.

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" style="max-width: 100%" src="https://www.youtube.com/embed/8vY-9tXlCW4" title="Spring Native and the Okta Spring Boot Starter" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

This stream originally aired on June 22, 2021. Since then, there have been a few Spring Boot releases and several Spring Native releases. And don't forget, there was another [SpringOne](https://twitter.com/mraible/status/1433072410182357000)!

## Okta Spring Boot Starter v2.1.1+ Supports Spring Native!

Today, I'm happy to announce that we've added our learnings to [Okta Spring Boot v2.1.1](https://github.com/okta/okta-spring-boot/releases/tag/okta-spring-boot-parent-2.1.1); now, it only takes a couple of lines to add native support to a Spring Boot application that uses Okta.

```java
import org.springframework.nativex.hint.NativeHint;
@NativeHint(options = "--enable-https")
```

Or, if you'd prefer a full example:

```java
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.nativex.hint.NativeHint;

@NativeHint(options = "--enable-https")
@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

If you'd like to see what it takes to migrate my previously mentioned native Java + Spring Boot example from using Spring Security OAuth to the Okta starter, look no further than [@oktadev/native-java-examples#5](https://github.com/oktadev/native-java-examples/pull/5).

You can also try it out yourself with the [Okta CLI](https://cli.okta.com). Install it and follow along below for a quick Okta + Spring Native example.

## Create a Native Spring Boot App

To create a secure Spring Boot app with Okta, run `okta start spring-boot`. You'll need to verify your email and set a password as part of this.

> **TIP:** If you already have an Okta account, you can run `okta login` first.

This command will download our [Okta Spring Boot sample](https://github.com/okta-samples/okta-spring-boot-sample), register your app on Okta, and configure it by adding your Okta settings to a `.okta.env` file.

> **IMPORTANT:**
>
> Keep your secrets out of source control by adding `okta.env` to your `.gitignore` file:
>
> ```shell
> echo .okta.env >> .gitignore
> ```

Add `@NativeHint(options = "--enable-https")` to the main `Application` class as specified above.

Next, edit your `pom.xml` and add the Spring Native version and classifier to the `<properties>` section:

```xml
<spring-native.version>0.10.4</spring-native.version>
<repackage.classifier/>
```

Then, replace the `<build>` section with the XML below:

```xml
<build>
    <defaultGoal>spring-boot:run</defaultGoal>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <classifier>${repackage.classifier}</classifier>
                <image>
                    <builder>paketobuildpacks/builder:tiny</builder>
                    <env>
                        <BP_NATIVE_IMAGE>true</BP_NATIVE_IMAGE>
                    </env>
                </image>
            </configuration>
        </plugin>
        <plugin>
            <groupId>org.springframework.experimental</groupId>
            <artifactId>spring-aot-maven-plugin</artifactId>
            <version>${spring-native.version}</version>
            <executions>
                <execution>
                    <id>test-generate</id>
                    <goals>
                        <goal>test-generate</goal>
                    </goals>
                </execution>
                <execution>
                    <id>generate</id>
                    <goals>
                        <goal>generate</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
<repositories>
    <repository>
        <id>spring-releases</id>
        <name>Spring Releases</name>
        <url>https://repo.spring.io/release</url>
        <snapshots>
            <enabled>false</enabled>
        </snapshots>
    </repository>
</repositories>
<pluginRepositories>
    <pluginRepository>
        <id>spring-releases</id>
        <name>Spring Releases</name>
        <url>https://repo.spring.io/release</url>
        <snapshots>
            <enabled>false</enabled>
        </snapshots>
    </pluginRepository>
</pluginRepositories>
```

_Giddyup!_

```shell
./mvnw spring-boot:build-image
# wait until image builds
docker run -it -p8080:8080 okta-spring-boot-sample:0.0.1-SNAPSHOT
```

Next, open your browser to `http://localhost:8080`. You'll likely be logged in straight away and see your name printed on the screen.

## Learn More About Spring Boot and Spring Native

We hope you learned something from this video and our experience. A huge thanks to Josh Long and [Andy Clement](https://spring.io/team/aclement) for their assistance during this stream. The [Spring Native docs](https://docs.spring.io/spring-native/docs/current/reference/htmlsingle/) are where you want to go to really dig in. If you prefer videos, I recommend watching [Josh Long's Spring Tips: Spring Native 0.10.0 video](https://www.youtube.com/watch?v=JsUAGJqdvaA).

Check out these posts for more information about Spring Boot and Spring Native:

- [Build Native Java Apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison)
- [R2DBC and Spring for Non-Blocking Database Access](/blog/2021/05/12/spring-boot-r2dbc)
- [Faster Spring Boot Testing with Test Slices](/blog/2021/07/12/spring-boot-test-slices)
- [How to Prevent Reactive Java Applications from Stalling](/blog/2021/08/13/reactive-java)
- [Spring Boot and Okta in 2 Minutes](/blog/2020/11/24/spring-boot-okta)

If you have any questions about this post, please add a comment below. For more interesting content, follow [@oktadev](https://twitter.com/oktadev) on Twitter, connect with us [on LinkedIn](https://www.linkedin.com/company/oktadev), and subscribe to [our YouTube channel](https://www.youtube.com/oktadev).
