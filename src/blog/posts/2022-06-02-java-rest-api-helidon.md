---
title: "Create a Java REST API with Helidon"
author: matt-raible
by: advocate
communities: [java]
description: "Learn how to build a Java REST API with Helidon in minutes!"
tags: [java]
tweets:
- "Learn how to build a Java REST API with Helidon and secure it with OAuth 2.0 in 9 minutes!"
- "Build a secure Java REST API with this quick tutorial."
- "Build a REST API with @oracle's open source Helidon framework! 🔮"
image: java-rest-api-helidon/java-rest-api-helidon.jpg
type: conversion
github: https://github.com/oktadev/native-java-examples/tree/main/helidon
---
In this tutorial, I'll show you how to create a secure REST API and native image with Helidon. You'll see how to run a secure, OAuth 2.0-protected, Java REST API that allows JWT authentication. Then, I'll compare its performance with Micronaut, Quarkus, and Spring Boot.

This tutorial is also available [as a screencast](https://youtu.be/Bj69rOIwQwY).

{% youtube "Bj69rOIwQwY" %}

**Prerequisites:**

- [SDKMAN](https://sdkman.io/) (for Java 17 with GraalVM)
- [HTTPie](https://httpie.io/) (a better version of cURL)
- An [Okta Developer](https://developer.okta.com) Account (or the [Okta CLI](https://cli.okta.com/))

> **TIP:** The brackets at the end of some steps indicate the IntelliJ Live Templates I used in the video. You can find the template definitions at [mraible/idea-live-templates](https://github.com/mraible/idea-live-templates).

[[toc]]

## Install a JDK with GraalVM

Use SDKMAN to install Java 17 with GraalVM

```
sdk install java 22.1.0.r17-grl
```

## Generate an OAuth 2.0 access token

1. Install the [Okta CLI](https://cli.okta.com/) and run `okta register` to sign up for a new account. If you already have an account, run `okta login`.
2. Run `okta apps create spa`. Set `oidcdebugger` as an app name and press **Enter**.
3. Use `https://oidcdebugger.com/debug` for the Redirect URI and set the Logout Redirect URI to `https://oidcdebugger.com`.
4. Navigate to the [OpenID Connect Debugger website](https://oidcdebugger.com/).
  1. Fill in your client ID
  2. Use `https://{yourOktaDomain}/oauth2/default/v1/authorize` for the Authorize URI
  3. Select **code** for the response type and **Use PKCE**
  4. Click **Send Request** to continue
5. Set the access token as a `TOKEN` environment variable in a terminal window.

   ```
   TOKEN=eyJraWQiOiJYa2pXdjMzTDRBYU1ZSzNGM...
   ```

## Build a Java REST API with Helidon

1. Create a Helidon app with OAuth 2.0 support:

   ```shell
   mvn -U archetype:generate -DinteractiveMode=false \
      -DarchetypeGroupId=io.helidon.archetypes \
      -DarchetypeArtifactId=helidon-quickstart-mp \
      -DarchetypeVersion=2.5.0 \
      -DgroupId=com.okta.rest \
      -DartifactId=helidon \
      -Dpackage=com.okta.rest
   ```

   > **TIP:** You can also install [Helidon's CLI](https://helidon.io/docs/v2/#/about/05_cli) and run `helidon init`.
2. Add MicroProfile JWT support in `pom.xml`:

   ```xml
   <dependency>
       <groupId>io.helidon.microprofile.jwt</groupId>
       <artifactId>helidon-microprofile-jwt-auth</artifactId>
   </dependency>
   ```
3. Add a `HelloResource` class that returns the user's information: [`h-hello`]

   ```java
   package com.okta.rest.controller;

   import io.helidon.security.Principal;
   import io.helidon.security.SecurityContext;

   import javax.ws.rs.GET;
   import javax.ws.rs.Path;
   import javax.ws.rs.Produces;
   import javax.ws.rs.core.Context;
   import java.util.Optional;

   import static javax.ws.rs.core.MediaType.TEXT_PLAIN;

   @Path("/hello")
   public class HelloResource {

       @GET
       @Produces(TEXT_PLAIN)
       public String hello(@Context SecurityContext context) {
           Optional<Principal> userPrincipal = context.userPrincipal();
           return "Hello, " + userPrincipal.get().getName() + "!";
       }
   }
   ```
4. Add a `HelloApplication` class in `src/main/java/com/okta/rest` to register your resource and configure JWT authentication: [`h-app`]

   ```java
   package com.okta.rest;

   import com.okta.rest.controller.HelloResource;
   import org.eclipse.microprofile.auth.LoginConfig;

   import javax.enterprise.context.ApplicationScoped;
   import javax.ws.rs.core.Application;
   import java.util.Set;

   @LoginConfig(authMethod = "MP-JWT")
   @ApplicationScoped
   public class HelloApplication extends Application {

       @Override
       public Set<Class<?>> getClasses() {
           return Set.of(HelloResource.class);
       }
   }
   ```
5. Add your Okta endpoints to `src/main/resources/META-INF/microprofile-config.properties`.

   ```properties
   mp.jwt.verify.publickey.location=https://{yourOktaDomain}/oauth2/default/v1/keys
   mp.jwt.verify.issuer=https://{yourOktaDomain}/oauth2/default
   ```

### Run and test your Helidon REST API with HTTPie

1. Start your app from your IDE or using a terminal:

   ```
   mvn package && java -jar ./target/helidon.jar
   ```
2. Test your API with an access token.

   ```
   http :8080/hello Authorization:"Bearer $TOKEN"
   ```

### Build a native Helidon app with GraalVM

1. Compile your Helidon app into a native executable using the `native-image` profile:

   ```
   mvn package -Pnative-image
   ```
2. Start your Helidon app:

   ```
   ./target/helidon
   ```
3. Test your API with an access token.

   ```
   http :8080/hello Authorization:"Bearer $TOKEN"
   ```

## Startup time comparison

I compared startup times between frameworks by running each image three times before recording the numbers. Then, I ran each app five more times and averaged the results. I gathered these numbers on a 2019 MacBook Pro with an SSD, 2.4 GHz 8-Core Intel Core i9 processor, and 64 GB of RAM.

<script src="https://www.gstatic.com/charts/loader.js"></script>
<div id="startup-times"></div>
<script>
google.charts.load('current', {packages: ['corechart', 'bar']});
google.charts.setOnLoadCallback(drawChart);
function drawChart() {
  var data = google.visualization.arrayToDataTable([
    ['Framework', 'Milliseconds to start', { role: 'style' }],
    ['Quarkus', 19.2, 'red'],
    ['Micronaut', 27.8, 'blue'],
    ['Helidon', 42.4, 'orange'],
    ['Spring Boot', 58.6, 'green']
  ]);
  var options = {
    title: 'Startup times of native Java frameworks',
    chartArea: {width: '50%'},
    hAxis: {
      title: 'Milliseconds',
      minValue: 0
    },
    vAxis: {
      title: 'Java Framework'
    }
  };
  var chart = new google.visualization.BarChart(document.getElementById('startup-times'));
  chart.draw(data, options);
}
</script>

**Versions used**: Quarkus 2.9.0, Micronaut 3.4.3, Helidon 2.5.0, and Spring Boot 2.6.7 with Spring Native 0.11.5.

## Memory usage comparison

I tested the memory usage (in megabytes) of each app using the command below. I ran it right after I started the app, after a single authenticated request, and after five authenticated requests.

```shell
ps -o pid,rss,command | grep --color <executable> | awk '{$2=int($2/1024)"M";}{ print;}'
```

The chart below shows the memory usage after five requests.

<div id="memory-usage" style="margin-bottom: 1.5em"></div>
<script>
google.charts.load('current', {packages: ['corechart', 'bar']});
google.charts.setOnLoadCallback(drawChart);
function drawChart() {
  var data = google.visualization.arrayToDataTable([
    ['Framework', 'Memory usage (MB)', { role: 'style' }],
    ['Quarkus', 36, 'red'],
    ['Micronaut', 56, 'blue'],
    ['Spring Boot', 62, 'green'],
    ['Helidon', 62, 'orange'],
  ]);
  var options = {
    title: 'Memory usage of native Java frameworks',
    chartArea: {width: '50%'},
    hAxis: {
      title: 'Megabytes',
      minValue: 0
    },
    vAxis: {
      title: 'Java Framework'
    }
  };
  var chart = new google.visualization.BarChart(document.getElementById('memory-usage'));
  chart.draw(data, options);
}
</script>

> **What about the MacBook Pro M1 Max?**
>
> My MacBook Pro (16-inch, 2021) with Apple M1 Max builds _much_ faster, apps start up 2x faster, but they use more memory.
>
> <div id="startup-times-m1"></div>
> <script>
> google.charts.load('current', {packages: ['corechart', 'bar']});
> google.charts.setOnLoadCallback(drawChart);
> function drawChart() {
>   var data = google.visualization.arrayToDataTable([
>     ['Framework', 'Milliseconds to start', { role: 'style' }],
>     ['Quarkus', 12, 'red'],
>     ['Micronaut', 17, 'blue'],
>     ['Helidon', 23, 'orange'],
>     ['Spring Boot', 36, 'green']
>   ]);
>   var options = {
>     title: 'Startup times of Java REST frameworks on Apple Silicon',
>     chartArea: {width: '50%'},
>     hAxis: {
>       title: 'Milliseconds',
>       minValue: 0
>     },
>     vAxis: {
>       title: 'Java Framework'
>     }
>   };
>   var chart = new google.visualization.BarChart(document.getElementById('startup-times-m1'));
>   chart.draw(data, options);
> }
> </script>
>
> <div id="memory-usage-m1"></div>
> <script>
> google.charts.load('current', {packages: ['corechart', 'bar']});
> google.charts.setOnLoadCallback(drawChart);
> function drawChart() {
>   var data = google.visualization.arrayToDataTable([
>     ['Framework', 'Memory usage (MB)', { role: 'style' }],
>     ['Quarkus', 47, 'red'],
>     ['Micronaut', 68, 'blue'],
>     ['Spring Boot', 75, 'green'],
>     ['Helidon', 84, 'orange'],
>   ]);
>   var options = {
>     title: 'Memory usage of Java REST frameworks on Apple Silicon',
>     chartArea: {width: '50%'},
>     hAxis: {
>       title: 'Megabytes',
>       minValue: 0
>     },
>     vAxis: {
>       title: 'Java Framework'
>     }
>   };
>   var chart = new google.visualization.BarChart(document.getElementById('memory-usage-m1'));
>   chart.draw(data, options);
> }
> </script>

## Comparing Native Java REST API Frameworks Live Stream

I missed Devoxx France this year, but I'm still doing my presentation! I'll be live-streaming [Comparing Native Java REST API Frameworks](https://speakerdeck.com/mraible/comparing-native-java-rest-api-frameworks-devoxx-france-2022) on June 7, 2022 at 6:00 MDT (14:00 CEST). Join me or watch the recorded version below!

{% youtube "dp3YbdIEyWU" %}

## Secure Native Java with Helidon FTW!

⚡️ Create a secure REST API with Helidon: `okta start helidon`

🚀 Find this example's code on GitHub: [@oktadev/native-java-examples/helidon](https://github.com/oktadev/native-java-examples/tree/main/helidon)

👀 Related blog post: [Build REST APIs and Native Java Apps with Helidon](/blog/2022/01/06/native-java-helidon)
