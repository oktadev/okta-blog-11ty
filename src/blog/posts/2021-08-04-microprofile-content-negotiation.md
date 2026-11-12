---
disqus_thread_id: 8692668660
discourse_topic_id: 17403
discourse_comment_url: https://devforum.okta.com/t/17403
title: "Content Negotiation with a Java MicroProfile Application"
author: brian-demers
by: advocate
communities: [java]
description: "Tutorial: API clients have different capabilities and needs! Learn how to make your server select the correct languages, media types, and compression!"
tags: [content-negotiation, microservices, java, quarkus, jaxrs]
tweets:
- "Languages and media-types and compression, Oh My‼️ Return the correct bits from your JAX-RS services‼️"
- "Do does your #Java-based REST API need to support multiple languages? Multiple response types? How about compression?  Learn how in this post 🧑‍🏫"
- "Learn how to support multiple response types and languages in your Java REST API 💥"
image: microprofile-content-negotiation/social.png
type: awareness
---
Content negotiation allows for an HTTP server to respond to different types of clients. Many modern clients expect a JSON response, but there may be a need to format responses differently, maybe XML for older clients or a binary format for newer ones. Content negotiation is the mechanism used to solve that problem and others, such as dealing with multiple languages and even compressing HTTP requests.

In this post, I'll walk through building a simple Java MicroProfile application and explain how content negotiation works.

## Prerequisites

- [Java 11+](https://adoptopenjdk.net/)
- [Apache Maven](https://maven.apache.org/download.cgi)
- [HTTPie](https://httpie.io/docs#installation)

If you want to skip ahead, the source for this example is on [GitHub](https://github.com/oktadev/quarkus-content-negotiation-example).

## What is MicroProfile?

Around 2016, the Java EE specifications had started to stagnate and suffered from long release cycles; as a result, newer web services APIs were falling behind. Created to spur innovation, the new [MicroProfile](https://microprofile.io/) project addressed the need to manage the existing Java JAX-RS, CDI, and JSON-P APIs, along with other new APIs for the evolving micro-services world.

Fast forward to today, Java EE has moved to [Jakarta EE](https://jakarta.ee/) under the [Eclipse Foundation](https://www.eclipse.org/org/foundation/) and many MicroProfile projects have matured into Jakarta EE projects.

> **TIP:** Some projects change root packages as they move between projects. Anything starting with `javax.*` may have moved to `jakarta.*` or `org.eclipse.*`.

## What is Content Negotiation?

In server-driven content negotiation, the client makes a request to a server with instructions on the type of response it can handle. When possible, the server responds with the appropriate format or returns a `406` or `415` status code.

At a high level, the conversation looks like this:

> **Client:**\
> Hey Server!\
> I'd like to look at `https://api.example.com/user/123`.\
> I need your response in JSON.

> **Server:**\
> No Problem Client!  Here is that response... {.text-right}

Another more verbose example might be:

> **Client:**\
> Hey Server!  I need `https://api.example.com/user/123`, preferably in JSON!\
> But, 😩 I'll take XML if that's all you have.\
> I also need the info in English or French.\
> Oh, please zip up the contents too.
>
> <div class="w-fit max-w-full">
>
> ```http
> GET /user/123 HTTP/1.1
> Accept: application/json,application/xml;q=0.9
> Accept-Encoding: gzip
> Accept-Language: en,fr
> Host: api.example.com
> User-Agent: Client/2.0
> ```
>
> </div>

> **Server:**\
> Hey Client!\
> All I have is XML (sorry about that), the response is in English,\
> and I was able to zip it; here you go... {.text-right}
>
> <div class="ml-auto w-fit max-w-full">
>
> ```http
> HTTP/1.1 200 OK
> Content-Type: application/xml
> Content-Encoding: gzip
> Content-Language: en
>
> <user id="123">
>   ...
> </user>
> ```
>
> </div>

I'd like to take this opportunity to apologize for using XML in this example 🤪

> **NOTE:** **Agent-driven** content negotiation works differently. In this case, the client must already be aware of the server's capabilities or must determine them by making a request to the server. This communication is not standardized.

## Content Negotiation Headers

In the previous example, I used the three content negotiation headers:

- `Accept` - The list of media types the client supports.
- `Accept-Encoding` - The list of compression algorithms the client supports.
- `Accept-Language` - The list of languages the client supports.

These "accept" headers allow for a ["quality value"](https://developer.mozilla.org/en-US/docs/Glossary/Quality_values) or a **q-factor** to define the client's preferences. When omitted, the default value is `1.0`. The example above of `application/json,application/xml;q=0.9` tells the server that JSON is preferred, but XML would be the next choice.

The server's response contains headers to let the client know which options were selected.

- `Content-Type` - The media type contained in the response.
- `Content-Encoding` - The compression algorithm used.
- `Content-Language` - The language of the response.

When I examine the request my browser made to display this blog post, it looks something like this:

<div class="scrollable">

|======= |Accept |text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,**/**;q=0.8,application/signed-exchange;v=b3;q=0.9 |Accept-Encoding |gzip, deflate, br |Accept-Language |en-US,en;q=0.9 |=======

</div>

My browser is telling the server: I'll take anything, but here's an ordered list of what I prefer:

1. HTML, XHTML, AVIF, WebP, or APNG
2. XML or a signed exchange
3. Anything else.

The browser supports `gzip`, `deflate`, and `br` compression. Finally, my language preference is US English (as in color spelled without a "u") or any English.

> **IMPORTANT:** There is a downside. These headers can also be used for [browser tracking and finger printing](https://coveryourtracks.eff.org/).

Enough primer, let's get on to the code!

## Create a MicroProfile Project With Quarkus

Most of the code below should be vendor agnostic, except where noted. Try out the example with your favorite [MicroProfile vendor](https://start.microprofile.io/), and let me know how it went in the comments!

Create a new project:

```sh
mvn io.quarkus:quarkus-maven-plugin:2.0.2.Final:create \
    -DprojectGroupId=com.example \
    -DprojectArtifactId=content-negotation \
    -DclassName="com.example.DiceResource" \
    -Dextensions="resteasy-jsonb"
    -Dpath="/roll"
cd content-negotation
```

If you haven't guessed, this example is going to evaluate dice notation. The [Dice Notation Parser](https://github.com/diceroll-dev/dice-parser) library will evaluate dice expressions such as `2d8+2` and return the results. Open up your `pom.xml` file and add the `dice-parser` dependency:

```xml
<dependency>
    <groupId>dev.diceroll</groupId>
    <artifactId>dice-parser</artifactId>
    <version>0.1.0</version>
</dependency>
```

Update the `DiceResource` class in `src/main/java/com/example/resources` to add a `GET` method:

```java
package com.example.resources;

import dev.diceroll.parser.ParseException;
import dev.diceroll.parser.ResultTree;

import javax.ws.rs.*;
import javax.ws.rs.core.*; // wildcard for brevity

import static dev.diceroll.parser.Dice.detailedRoll;

@Path("/roll")
public class DiceResource  {

    @GET
    public ResultTree rollObject(@QueryParam("dice") String dice) throws ParseException {
        return detailedRoll(dice);
    }
}
```

Start the server either from your favorite IDE or from the command line with:

```sh
mvn quarkus:dev
```

> **TIP:** All of the code changes you'll make _should_ hot reload, but if you don't see the changes as you continue, just kill the process and start it up again.

Make sure things are working by making a request—and roll a single six-sided die.

```sh
http :8080/roll dice==d6
```

```http
HTTP/1.1 200 OK
Content-Length: 148
Content-Type: application/json

{
    "expression": {
        "numberOfDice": 1,
        "numberOfFaces": 6
    },
    "results": [{
        "expression": {
            "numberOfDice": 1,
            "numberOfFaces": 6
        },
        "results": [],
        "value": 6
    }],
    "value": 6
}
```

Now that the app is working, let's tweak some things and look at how the response changes!

## Enable Compression for the REST Resources

Compression isn't one of those features you should need to worry about. You [_could_ deal with the compression logic yourself](https://eclipse-ee4j.github.io/jersey.github.io/documentation/latest/filters-and-interceptors.html#d0e9756), but most vendors have a configuration property you can tweak to turn it on.

For Quarkus, add the following line to your `src/main/resources/application.properties`:

```properties
quarkus.http.enable-compression=true
```

Make another HTTP request and include the `Accept-Encoding` header, and this time we will roll `2d6`:

<div class="example">

```sh
http :8080/roll dice==2d6 "Accept-Encoding: gzip"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip // <1>
Content-Length: 106

{
    "expression": {
        "numberOfDice": 2,
        "numberOfFaces": 6
    },
    ...
    "value": 9
}
```

1. The response `Content-Encoding` header was set (HTTPie automatically unzipped the request)
{.colist}

</div>

> **NOTE:**
>
> If you wanted to do the same thing with `curl` you would need to pipe the result to gunzip:
>
> ```sh
> curl localhost:8080/roll\?dice=2d6 -H "Accept-Encoding: gzip" | gunzip
> ```

## Using the Request Accept-Language Header

It's 2021, and implementing internationalization (i18n) is still hard. In the Java world, i18n usually means creating a `Locale` object containing the user's language. It's a little clunky to use, but the JAX-RS API defines a way to resolve the user's `Locale`. Let's look at a couple of different ways to manage this.

Add a new endpoint method in `DiceResource`:

<div class="example">

```java
@Path("/lang")
@GET
public Response getLang(@Context Request request) {
    List<Variant> variants = Variant.VariantListBuilder.newInstance() // <1>
            .languages(Locale.ENGLISH, Locale.GERMAN) // <2>
            .build();

    Variant variant = request.selectVariant(variants); // <3>

    if (variant == null) { // <4>
        return Response.notAcceptable(variants).build();
    }

    // set the response header, to the client knows which language was selected
    String lang = variant.getLanguageString();
    return Response.ok(lang)
            .header(HttpHeaders.CONTENT_LANGUAGE, lang)
            .build(); // <5>
}
```

1. Use the variant list builder to select the language from the "Accept-Languages" header.
2. You will need to list all of your supported languages; order is important; the default option is the first if there is no `Accept-Language` header.
3. Use the request to select the correct variant.
4. If the selected variant is `null` return a `406`.
5. Build and return a `200` response.
{.colist}

</div>

> **TIP:** The `VariantBuilder` also supports different encodings and `MediaType` too.

Try it out! Make a request to `/roll/lang`:

<div class="example">

```sh
http :8080/roll/lang "Accept-Language: de"
```

```http
HTTP/1.1 200 OK
Content-Language: de // <1>
Content-Type: text/plain;charset=UTF-8
Vary: Accept-Language
content-encoding: gzip
content-length: 28

de
```

1. Note the `Content-Language` header.
{.colist}

</div>

The above approach works well for showing off the API, but it's a little limited in real-world usages as every endpoint method returns a `Response` and manages the headers directly. It would be nicer to extract this cross-cutting concern.

Another option is to use request and response filters. The next example implements both `ContainerRequestFilter` and `ContainerResponseFilter` interfaces. Create a new class `LanguageFilter`:

<div class="example">

```java
package com.example;

import javax.ws.rs.container.*;
import javax.ws.rs.core.*; // wildcard for brevity
import javax.ws.rs.ext.Provider;
import java.util.List;
import java.util.Locale;

@Provider
public class LanguageFilter implements ContainerRequestFilter, ContainerResponseFilter {

    final private static String LANG = "LanguageFilter.lang";

    final public static List<Variant> VARIANTS = Variant.VariantListBuilder.newInstance()
            .languages(Locale.ENGLISH, Locale.GERMAN) // <1>
            .build();

    @Override
    public void filter(ContainerRequestContext requestContext) {
        Variant variant = requestContext.getRequest().selectVariant(VARIANTS); // <2>

        if (variant == null) { // <3>
            // Error, respond with 406
            requestContext.abortWith(Response.notAcceptable(VARIANTS).build());
        } else {
            // keep the resolved lang around for the response
            requestContext.setProperty(LANG, variant.getLanguageString()); // <4>
        }
    }

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
        String lang = (String) requestContext.getProperty(LANG);
        responseContext.getHeaders().putSingle(HttpHeaders.CONTENT_LANGUAGE, lang); // <5>
    }
}
```

1. Define the supported languages.
2. Select the `Variant` based on the request.
3. If a compatible `Variant` is not found, return a `406`.
4. Add the resolved language string to the request context.
5. Set the `Content-Language` response header.
{.colist}

</div>

> **NOTE:** Having spent years dealing with the Servlet API, I often make incorrect assumptions about how the JAX-RS API is structured. With JAX-RS, the request and response filtering are different interfaces.

This solution works with any endpoint; test out the original `/roll` endpoint again. Dice notation allows for basic math, too; try to roll `2d8+1` (two eight-sided dice plus one).

<div class="example">

```sh
http :8080/roll dice==2d8+1 "Accept-Language: en"
```

```http
HTTP/1.1 200 OK
Content-Language: en
Content-Type: application/json
Vary: Accept-Language
content-encoding: gzip
content-length: 154

{
    "expression": {
        "left": {
            "numberOfDice": 2,
            "numberOfFaces": 8
        },
        "operation": "ADD",
        "right": {
            "value": 1
        }
    },
    "results": [
    ...
    ],
    "value": 8
}
```

</div>

So far, so good!

## Different Responses for Different Clients

Up until now, the simple `/roll` endpoint has been returning JSON, which is excellent if you are building a client that accepts JSON, but it's not very user-friendly for text-based clients like HTTPie or curl. Two changes are needed to support a plain text response: Annotate the endpoint with an `@Produces` annotation and add a `MessageBodyWriter` to convert the dice parser's `ResultTree` object into text.

Add the following `@Produces` annotation to `DiceResource`, to indicate it supports both `text/plain` and `application/json`:

```java
@Path("/roll")
@Produces({MediaType.TEXT_PLAIN, MediaType.APPLICATION_JSON })
public class DiceResource  {
...
```

If you make a request to the `/roll` endpoint now, you will get an ugly response due to a call to the `toString()` method on `ResultTree`. 🤢

To fix this, create a new class `TextDiceTreeMessageBodyWriter.java` that implements `MessageBodyWriter<ResultTree>`, which renders something a little easier on the eyes:

<div class="example">

```java
package com.example;

import dev.diceroll.parser.Dice;
import dev.diceroll.parser.ResultTree;

import javax.ws.rs.Produces;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.ext.MessageBodyWriter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;

@Provider
@Produces(MediaType.TEXT_PLAIN) // <1>
public class TextDiceTreeMessageBodyWriter implements MessageBodyWriter<ResultTree> {

    @Override
    public boolean isWriteable(Class<?> type, Type genericType, Annotation[] annotations, MediaType mediaType) {
        return type == ResultTree.class; // <2>
    }

    @Override
    public void writeTo(ResultTree resultTree,
                        Class<?> type, Type genericType,
                        Annotation[] annotations,
                        MediaType mediaType,
                        MultivaluedMap<String, Object> httpHeaders,
                        OutputStream entityStream) throws IOException, WebApplicationException {

        String result = Dice.debug(resultTree); // <3>
        entityStream.write(result.getBytes(StandardCharsets.UTF_8)); // <4>
    }
}
```

1. Add a `Produces` annotation to the class to mark the `MediaType` it supports.
2. This example keeps things simple and only supports the `ResultTree` class.
3. Calling `Dice.debug` will turn the result into text.
4. Write the string to the response stream.
{.colist}

</div>

Time to test it out! Call `/roll` again roll `3d10k2+1` (roll three eight-sided dice and keep the highest two, then add one to the result):

<div class="example">

```sh
http :8080/roll dice==3d10k2 "Accept: text/plain"
```

```http
HTTP/1.1 200 OK
Content-Language: en
Content-Type: text/plain;charset=UTF-8
Vary: Accept-Language
content-encoding: gzip
content-length: 69

3d10k2 + 1 = 8
--3d10k2 = 7
----d10 = 4
----d10 = 2
----d10 = 3
--1 = 1
```

</div>

Much better! Change the `Accept` header value to `application/json` to see for yourself.

## Bonus: User Agent for Content Negotiation

Using the User-Agent header for content negotiation might not be your first choice. Still, it works great for a few use cases, for example when dealing with legacy clients that don't _correctly_ handle adding new fields to a JSON response object.

> **TIP:** If you are using Jackson to unmarshal JSON consider adding the `@JsonIgnoreProperties(ignoreUnknown = true)` annotation to your client code to handle additive changes in REST APIs gracefully.

One of my favorite examples of using the User-Agent for content negotiation is adding descriptive help to a REST server. I learned this trick from the [Spring Initializer project](https://github.com/spring-io/start.spring.io), which returns different results if you use HTTPie or curl: `https://start.spring.io`.

To detect the user agent, add an enum that contains basic user-agent parsing logic.

<div class="example">

```java
package com.example;

import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public enum Agents {

    CURL("curl"),
    HTTPIE("HTTPie");

    final private String agentName;
    final private static Pattern TOOL_REGEX = Pattern.compile("([^\\/]*)\\/([^ ]*).*"); // <1>

    Agents(String agentName) {
        this.agentName = agentName;
    }

    public static Agents parse(String userAgent) { // <2>
        Matcher matcher = TOOL_REGEX.matcher(userAgent);
        String name = (matcher.matches()) ? matcher.group(1) : null;
        return Arrays.stream(Agents.values())
                .filter(agent -> agent.agentName.equals(name))
                .findFirst()
                .orElse(null);
    }
}
```

1. This regex looks for `{name}/{version}`
2. Calling `Agents.parse(userAgent)` will return an enum associated with Curl, HTTPie, or `null`.
{.colist}

</div>

> **WARNING:** User-Agent parsing is a much more complex topic; the above code works well because we are looking for a few specific clients.  This is not a general-purpose solution.

Now that I have logic to figure out the user-agent, I'll create a helper class to wrap the logic of returning localized help text. Create a new class `Help.java`:

<div class="example">

```java
package com.example;

import javax.ws.rs.core.UriInfo;
import java.text.MessageFormat;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;

public class Help {

    final static private Map<Agents, String> AGENT_HELP_MAP = Map.of(
            Agents.CURL, "help.curl",
            Agents.HTTPIE, "help.httpie"
    );

    public static String getHelp(String userAgent, UriInfo uriInfo, Locale locale) {

        String url = uriInfo.getBaseUri().resolve("/").toString(); // <1>

        Agents agent = Agents.parse(userAgent); // <2>

        // look up the help key
        String helpKey = AGENT_HELP_MAP.getOrDefault(agent, "help.generic"); // <3>

        // Resource Bundle lookup/formatting
        ResourceBundle resourceBundle = ResourceBundle.getBundle("messages", locale); // <4>
        MessageFormat formatter = new MessageFormat(resourceBundle.getString(helpKey), locale);
        return formatter.format(new Object[] { url });
    }
}
```

1. Resolve the base URL of the request `UriInfo`.
2. Parse the user-agent header and return an `Agents` enum.
3. Look up the help text key, or default to `help.generic`.
4. Get and format a string from a `ResourceBundle`.
{.colist}

</div>

Create the corresponding `ResourceBundle` in `src/main/resources/messages.properties` :

```properties
help.generic = \
    Welcome to the Dice Parser!!\n\n\
    Roll dice by making a request:\n\
    \    GET {0}roll?dice=2d6\n\
    \    Accept: text/plain\n\n\
    Or get the result in JSON:\n\
    \    GET {0}roll?dice=2d6\n\
    \    Accept: application/json

help.httpie = \
    Welcome to the Dice Parser!!\n\n\
    Roll dice by making a request:\n\
    \    http {0}roll dice==2d6 \"Accept: text/plain\"\n\n\
    Or get the result in JSON:\n\
    \    http {0}roll dice==2d6 \"Accept: application/json\"

help.curl = \
    Welcome to the Dice Parser!!\n\n\
    Roll dice by making a request:\n\
    \    curl {0}roll?dice=2d6 -H \"Accept: text/plain\"\n\n\
    Or get the result in JSON (the default):\n\
    \    curl {0}roll?dice=2d6 -H \"Accept: application/json\"
```

Add a German translation of this file (thanks to Google Translate), in `src/main/resources/messages_de.properties`:

```properties
help.generic = \
    Willkommen beim Würfelparser!!\n\n\
    Würfeln Sie, indem Sie eine Anfrage stellen:\n\
    \    GET {0}roll?dice=2d6\n\
    \    Accept: text/plain\n\n\
    Oder rufen Sie das Ergebnis in JSON ab:\n\
    \    GET {0}roll?dice=2d6\n\
    \    Accept: application/json

help.httpie = \
    Willkommen beim Würfelparser!!\n\n\
    Würfeln Sie, indem Sie eine Anfrage stellen:\n\
    \    http {0}roll dice==2d6 \"Accept: text/plain\"\n\n\
    Oder rufen Sie das Ergebnis in JSON ab:\n\
    \    http {0}roll dice==2d6 \"Accept: application/json\"

help.curl = \
    Willkommen beim Würfelparser!!\n\n\
    Würfeln Sie, indem Sie eine Anfrage stellen:\n\
    \    curl {0}roll?dice=2d6 -H \"Accept: text/plain\"\n\n\
    Oder rufen Sie das Ergebnis in JSON ab:\n\
    \    curl {0}roll?dice=2d6 -H \"Accept: application/json\"
```

> **NOTE:** You could use your favorite template framework for this instead of using a `ResourceBundle` directly.

Lastly, create a new `HelpResource` class to tie everything together:

<div class="example">

```java
package com.example;

import javax.ws.rs.*;
import javax.ws.rs.core.*; // for brevity

@Path("/")
public class HelpResource {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String help(@HeaderParam(HttpHeaders.USER_AGENT) String userAgent, // <1>
                       @Context Request request, // <2>
                       @Context UriInfo uriInfo) { // <3>
        return Help.getHelp(userAgent,
                uriInfo,
                request.selectVariant(LanguageFilter.VARIANTS).getLanguage()); // <4>
    }
}
```

1. The User-Agent request header.
2. The `Request` object (needed to select the correct language `Variant`).
3. The URI of the request.
4. Pass everything into `Help.getHelp()` to return the localized help message.
{.colist}

</div>

The default Quarkus application adds a static `index.html` file to use as the **root** resource; delete this file so the new `HelpResource` can take its place:

```sh
rm src/main/resources/META-INF/resources/index.html
```

Put everything you learned together and make a request to `localhost:8080/`:

<div class="example">

```sh
http :8080/ "Accept-Language: en" "Accept: text/plain" "Accept-encoding: gzip"
```

```http
HTTP/1.1 200 OK
Content-Language: en
Content-Type: text/plain;charset=UTF-8
Vary: Accept-Language
content-encoding: gzip
content-length: 251

Welcome to the Dice Parser!!

Roll dice by making a request:
    http http://localhost:8080/roll?dice=2d6 "Accept: text/plain"

Or get the result in JSON:
    http http://localhost:8080/roll?dice=2d6 "Accept: application/json"
```

</div>

## Learn More About Java Web Services

In this post, you have learned how to build a simple MicroProfile application using Quarkus and the JAX-RS API to take advantage of content negotiation.

There is still one big thing missing from this application, security! If you would like to see a follow-up post securing this application, let us know in the comments below. Until then, you can learn how to secure Java-based microservices with these posts:

- [Security Patterns for Microservice Architectures](/blog/2020/03/23/microservice-security-patterns)
- [Java REST API Showdown](/blog/2020/01/09/java-rest-api-showdown)
- [Build Native Java Apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison)

If you have questions, please leave a comment below. If you liked this tutorial, follow [@oktadev](https://twitter.com/oktadev) on Twitter, follow us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
