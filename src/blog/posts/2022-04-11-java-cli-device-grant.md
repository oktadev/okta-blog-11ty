---
title: "Authenticate from the Command Line with Java"
author: brian-demers
by: advocate
communities: [java]
description: "Tutorial: Build a Java application with JBang that uses the OAuth 2.0 Device Grant and log in with a code."
tags: [java, oauth, oauth2, cli, access-tokens, command-line]
tweets:
- "OAuth isn't just for web applications, terminal apps can authenticate the same way as your smart TV 📺"
- "Ever wondered how you log into your TV using a code? This #Java CLI app will show you how with 2 requests‼️"
- "Command line applications need authentication too! It just takes two HTTP requests💥"
image: java-cli-device-grant/oauth-java-cli-social.jpeg
type: conversion
---
Anyone who has tried to type a password using a television remote can tell you what a pain it is. Not only will you be frustrated with the keyboard, but it's not secure; everyone else in the room can see what you are typing. Fortunately, the OAuth 2.0 Device Authorization Grant gives you an easier way to sign in. The name is a mouthful, but if you have ever logged in to a TV by scanning a QR code or typing a short code, you've already used this flow.

{% img {src: "java-cli-device-grant/device-grant-tv.jpg", alt: "Login with QR code", header: "800"} %}

The great thing about this authentication flow is that it isn't just for televisions. It works with any "input restricted" internet-connected device, including alarm clocks, [Arduinos](https://auth0.com/blog/build-user-signup-counter-with-arduino-part2/), and even command-line tools.

In this post, I'll walk through how the OAuth 2.0 Device Authorization Grant works and build a basic Java console application!

If you want to skip the text and jump directly into the example code, you can find it on [our GitHub repo](https://github.com/oktadev/okta-device-grant-java-example).

**Prerequisites:**

- An Okta organization - (Sign up for free using your [browser](https://developer.okta.com/signup/), or the [Okta CLI](https://cli.okta.com/))
- [Java 11+](https://adoptium.net/) (Tested with 11, 17, & 18)
- [JBang](https://www.jbang.dev/download/) (v0.92.2)

[[toc]]

## How does the OAuth 2.0 Device Authorization Grant work?

At a high level, the flow works like this:

1. A device or application initiates the flow `POST /v1/device/authorize`
2. The IdP responds with a "device code", "user code", and a URL.
3. The user is instructed to visit the URL,  enter the "user code", and authenticate.
4. The application polls the IdP using the "device code" until the user has logged in.
5. The IdP responds with an access token.

{% img {src: "java-cli-device-grant/flow-diagram.jpg", alt: "Device grant flow diagram", header: "800"} %}

> **NOTE:** This example will work the same with any Identity Provider (IdP) that supports the flow, but you may need to tweak the URLs.

## OAuth 2.0 from the command line

You might not think of your terminal as an "input restricted device", but that doesn't mean you should type a website's passwords into your console. There are a few problems to be aware of related to this:

- You should ONLY enter a password into the website it was created for.
- Your terminal doesn't support the same factors your browser does.
- You may be ssh'd into another computer.

> **NOTE:** The Authorization Device Grant requires a user. If you are trying to call APIs from an automated process or other server-to-server communication, check out the [OAuth 2.0 Client Credential Flow](/blog/2021/05/05/client-credentials-spring-security).

## Set up Okta

First, you need to create an Okta application that supports the Device Grant.

1. In **Applications**->**Applications**, click **Create App Integration**. In the pop-up, choose **OIDC - OpenID Connect**, then **Native Application**. The Device Grant is only available for Native Applications.

   {% img {src: "java-cli-device-grant/create-native-app.jpg", alt: "Set up a native app", header: "800"} %}
2. In the next step, check **Device Authorization** in the **Grant type** section.

   {% img {src: "java-cli-device-grant/enable-device-flow.jpg", alt: "Enable device grant", header: "800"} %}

Make a note of the **Client ID**, you will need it below.

If you are using an [Okta Authorization Server](https://developer.okta.com/docs/concepts/auth-servers/#available-authorization-server-types), you also need to enable the grant type in the authorization server's policy interface:

1. Go to **Security**->**API**.
2. Select the authorization server you want to use (for example, "default").
3. Click the **Access Policies** tab, and edit the rule for your policy. Make sure to select the **Device Authorization** check box.

   {% img {src: "java-cli-device-grant/custom-as.jpg", alt: "Enable device flow on a custom Authorization Server", header: "800"} %}

Make note of your Issuer URI. If you are using an Okta Custom Authorization Server, it will look something like this (updating the hostname to match your Okta Org):

```txt
https://dev-133337.okta.com/api/v1/authorizationServers/default
```

Otherwise, it will be the same as your Okta URL:

```txt
https://dev-133337.okta.com
```

## Create a Java application

On to the fun part, writing some code!

Create a new project in your favorite IDE. (I'm a fan of [IntelliJ IDEA](https://www.jetbrains.com/idea/).) The code below uses the `java.net.http.HttpClient`, make sure our target Java is set to at least `11`.

The `HttpClient` API is much easier to use than its predecessor `URLConnection`, but Java is still no way to parse JSON out of the box. Add a dependency on [Jackson Databind](https://github.com/FasterXML/jackson-databind) to fix that.

To keep things all contained in a single `java` file, I'll use [JBang](https://www.jbang.dev). If you haven't used JBang before, here's the TL;DR: JBang makes it easy to create Java... scripts. It's a scripting tool that  lets you run Java application with minimal setup. Your project dependencies get added to the top of the `java` file.

Create a new `DeviceGrant.java` and add `jackson-databind` as a dependency:

```java
//DEPS com.fasterxml.jackson.core:jackson-databind:2.13.2 // <1>

import com.fasterxml.jackson.databind.ObjectMapper; // <2>

import java.awt.*; // <3>
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static java.util.stream.Collectors.joining;

public class DeviceGrant {

    public static void main(String[] args) throws Exception {

    }
}
```

1. Make sure there is no space between the `//` and `DEPS`.
2. Add the following imports, they will be used below.
3. AWT? Yes, keep reading I'll get to that 😉

Execute the application from the command line using:

```shell
jbang DeviceGrant.java
```

This application doesn't do anything yet. We can fix the in the next few steps!

### A little more boilerplate

The fluent `HttpClient` is handy, but along with not having JSON support, it also doesn't have direct support for form-encoded requests. Fortunately, both issues are easy to fix by adding a couple of helper methods.

In `DeviceGrant.java` add the following two methods:

```java
// Convert a map into a encoded form body
private static HttpRequest.BodyPublisher formBody(Map<String, String> params) {
    // Wrap an encoded String in a BodyPublisher
    return HttpRequest.BodyPublishers.ofString(
        // url encode <key>=<value>&
        params.entrySet().stream()
            .map(entry -> URLEncoder.encode(entry.getKey(), UTF_8)
                          + "="
                          + URLEncoder.encode(entry.getValue(), UTF_8))
            .collect(joining("&")));
}

// parse a response body using Jackson
public static <W> HttpResponse.BodySubscriber<W> parseJson(Class<W> targetType) {
    return HttpResponse.BodySubscribers.mapping(
        HttpResponse.BodySubscribers.ofByteArray(),
        (byte[] bytes) -> {
            try {
                ObjectMapper objectMapper = new ObjectMapper();
                return objectMapper.readValue(bytes, targetType);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
}
```

## Initiate the authorization request

From the above [Set up Okta](#setup-okta) section you have a public "client id" and "issuer" URI. For the sake of convenience, set those as `String` variables:

```java
public static void main(String[] args) throws Exception {

    String clientId = "your-client-id-here" ;
    String issuer = "https://dev-l33337.okta.com/oauth2/default";
```

> **IMPORTANT:** These values are public, meaning they are safe to bundle in your application.

```java
// Create a client
HttpClient client = HttpClient.newHttpClient();

// List of scopes requested by your application (oauth scopes are space separated)
String scopes = String.join(" ", "openid", "profile", "offline_access");

// HTTP POST form arguments
Map<String, String> authArgs = Map.of(
    "client_id", clientId,
    "scope", scopes); // the arg name IS the singular form of scope
```

Using the fluent API, create a post request to `$\{issuer}/v1/device/authorize`, including the client ID and scopes.

```java
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(issuer + "/v1/device/authorize"))
    .POST(formBody(authArgs))
    .header("Accept", "application/json")
    .header("Content-Type", "application/x-www-form-urlencoded")
    .build();

// execute the request
HttpResponse<Map> httpResponse = client.send(request, rs -> parseJson(Map.class));

// Fail on anything except a 200 response
if (httpResponse.statusCode() != 200) {
    System.err.println("Error: " + httpResponse);
    throw new RuntimeException("Failed to initialize device grant authorization, likely " +
                               "caused by an invalid IdP configuration");
}

Map authorizationResponse = httpResponse.body();

String deviceCode = (String) authorizationResponse.get("device_code");
String verificationUri = (String) authorizationResponse.get("verification_uri");
String userCode = (String) authorizationResponse.get("user_code");
String verificationUriComplete = (String) authorizationResponse.get("verification_uri_complete");
Duration interval = Duration.ofSeconds((int) authorizationResponse.get("interval"));
Duration expiresIn = Duration.ofSeconds((int) authorizationResponse.get("expires_in"));
```

> **NOTE:** To keep the steps minimal in this post, I'm parsing the JSON to a map, but you could create a typed object to avoid any of the above casting.

Assuming all went well, the response returned from the IdP will be a JSON block (parsed into the above values) that looks like this:

```json
{
  "device_code": "a-random-device-code", # <1>
  "user_code": "ABCD1234", # <2>
  "verification_uri": "https:/dev-l33337.okta.com/activate", # <3>
  "verification_uri_complete": "https:/dev-l33337.okta.com/activate?user_code=ABCD1234", # <4>
  "expires_in": 600, # <5>
  "interval": 5 # <6>
}
```

1. `device_code` - A secret known by the device/application, it will be used in the following steps.
2. `user_code` - Shown to the user, and ties a different browser session to this device/application.
3. `verification_uri`- URL the user needs to visit and type enter the `user_code` before logging in.
4. `verification_uri_complete` - A URL combining the `verification_uri` and `user_code` which can be shown directly to the user (if they can copy and paste) or rendered as a QR code (on a TV).
5. `expires_in` - Number of seconds the user has to finish the flow before the codes expire.
6. `interval` - Minimum frequency in seconds the application should wait while polling the server to see if the user has been authorized.

### User login via a browser

The end user needs to open a browser to log in, how they do that is up to your application. For the best user experience, you may want to open a browser automatically. However, that might not be possible, so always fall back to showing the URL and code.

```java
// check if a browser can be opened
if (!GraphicsEnvironment.isHeadless() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
    System.out.println("Opening browser to: " + verificationUriComplete);
    Desktop.getDesktop().browse(URI.create(verificationUriComplete));
} else {
    System.out.println("Open a browser and go to: " + verificationUri +
                       "  enter the code: "+ userCode);
}
```

> **TIP:** The Abstract Window Toolkit (AWT) is Java's _original_ platform-independent UI framework. If you are building a JavaFX application, you may want to avoid mixing AWT and use the [JavaFX `HostServices`](https://openjfx.io/javadoc/17/javafx.graphics/javafx/application/HostServices.html#showDocument(java.lang.String)) instead.

If you are building an application for a television, you may want to render the value of `verificationUriComplete` as a QR code, so the user can scan it with a mobile device.

Whichever method you choose, the user will need to confirm the activation code before authenticating.

{% img {src: "java-cli-device-grant/enter-device-code.jpg", alt: "Enter code before logging in", header: "600"} %}

### Get an access token

While the user is logging in, the application will continue making requests to the IdP, checking if the user has authorized the application.

Using the `device_code` from the initial request, continue to poll the IdP for the authorization status until the code expires.

```java
long pollUntilMillis = System.currentTimeMillis() + expiresIn.toMillis();
while (System.currentTimeMillis() < pollUntilMillis) {

    // first sleep, give the user time to log in!
    System.out.println("Sleeping for " + interval.getSeconds() + " seconds");
    Thread.sleep(interval.toMillis()); // <1>

    Map<String, String> tokenArgs = Map.of("client_id", clientId,
        "grant_type","urn:ietf:params:oauth:grant-type:device_code", // <2>
        "device_code", deviceCode);

    HttpRequest tokenRequest = HttpRequest.newBuilder() // <3>
        .uri(URI.create(issuer + "/v1/token"))
        .POST(formBody(tokenArgs))
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .build();

    HttpResponse<Map> tokenResponse =
        client.send(tokenRequest, rs -> parseJson(Map.class));

    if (tokenResponse.statusCode() == 200) { // <4>
        // Do something with the tokens
        System.out.println("Authorization complete!");
        System.out.println(tokenResponse.body());
        break;
    } else {
        // error, keep polling until timeout
        System.out.println("Error: " + tokenResponse.body());
        System.out.println(tokenResponse);
    }
}
```

1. Wait for the interval to avoid spamming the server, it's going to take a bit for the user to log in anyway.
2. Set the `grant_type` to the URN for the device grant.
3. Make a request to `/v1/token` to check the authorization status.
4. If the response is a `200` inspect the body for an access token, otherwise continue the polling loop.

If the user has not yet logged in, an error is returned with the `authorization_pending` message:

```json
{
  "error": "authorization_pending",
  "error_description": "The device authorization is pending. Please try again later."
}
```

Otherwise, if the user has already logged in, a response containing an access token will be returned:

```json
{
  "token_type": "Bearer",
  "expires_in": 3600,
  "access_token": "...",
  "scope": "openid profile offline_access",
  "id_token": "..."
}
```

> **NOTE:** This access token would be used to make application-specific REST requests on behalf of the user, typically by setting the `Authorization` header in an HTTP request. For example:

```java
HttpRequest.newBuilder()
        .header("Authorization", "Bearer " + accessToken)
```

## Putting it all together

If you haven't already skipped ahead to run the finished application, run it now:

```shell
jbang DeviceGrant.java
```

This will open a browser and display a code. Make sure this code matches what is displayed in your terminal, and continue logging in.

## Learn more about OAuth

How you authenticate and authorize a user changes based on the capabilities of your application. This post has shown how to build a command-line Java application that authenticates a user with two simple HTTP requests, while allowing them to authenticate using the device and browser of their choice.

Learn more about building secure applications by reading these posts:

- [How to Use Client Credentials Flow with Spring Security](/blog/2021/05/05/client-credentials-spring-security)
- [Spring Boot and Okta in 2 Minutes](/blog/2020/11/24/spring-boot-okta)
- [Build REST APIs and Native Java Apps with Helidon](/blog/2022/01/06/native-java-helidon)

Please comment below with any questions. For more interesting content, follow [@oktadev](https://twitter.com/oktadev) on Twitter, find us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/oktadev).
