---
title: "Introducing Spring Native for JHipster: Serverless Full-Stack Made Easy"
author: matt-raible
by: advocate
communities: [java]
description: "Do you want to build a full-stack Java webapp that starts in milliseconds? Spring has your back! 👊"
tags: [java, spring-boot, spring-native, jhipster, graalvm, auth0]
tweets:
- "Start your @JHipster + Spring Boot app in under a second with Spring Native and @GraalVM!"
- "Introducing JHipster Native: 'Wow! That was quick!'"
- "Spring Boot + Spring Native + { Angular, React, Vue } = JHipster! 🚀"
image: spring-native-jhipster/spring-native-jhipster.png
type: conversion
github: https://github.com/oktadev/auth0-full-stack-java-example/tree/spring-native
changelog:
- 2022-04-22: Updated to use JHipster Native 1.1.2. See this post's changes in [okta-blog#1152](https://github.com/oktadev/okta-blog/pull/1152) and the example app changes in [auth0-full-stack-java-example#17](https://github.com/oktadev/auth0-full-stack-java-example/pull/17).
- 2022-04-15: Updated to use JHipster 7.8.1 and JHipster Native 1.1.1. See this post's changes in [okta-blog#1137](https://github.com/oktadev/okta-blog/pull/1137) and the example app changes in [auth0-full-stack-java-example#15](https://github.com/oktadev/auth0-full-stack-java-example/pull/15).
---
Over the years, I've developed a lot of Java applications. I started writing Java code in the late 90s and spent several years doing Java before I tried another server-side language. I was impressed when I first tried building apps in Ruby on Rails, Python, and Node.js - they all started super-fast!

Starting fast is cool, but we in the Java community have often asked, does it perform over time? The Java Virtual Machine is famous for performance and optimization over time.

I scoffed at serverless when it first came out. Mostly because I was a Java developer and my apps didn't start in milliseconds. They also used a whole lotta memory and there was no hope in sight.

Then, along came [GraalVM](https://www.graalvm.org/). It's gained support from many Java frameworks in the last few years and has made their apps start in milliseconds!

Today, I'm proud to announce that this same capability is now available for your JHipster 7+ apps!

{% include "integrator-org-warning.njk" %}

**Prerequisites**:

- [Node 14](https://nodejs.org/)+
- [Java 17 with GraalVM](https://sdkman.io/)+
- [Docker Desktop](https://docs.docker.com/desktop/#download-and-install)

[[toc]]

If you'd rather learn visually, you can [watch a video of this tutorial](https://youtu.be/8hPDL9GCD5Q).

{% youtube "8hPDL9GCD5Q" %}

## Why should you care about serverless?

From [IBM's What is Serverless computing?](https://www.ibm.com/cloud/learn/serverless)

> Serverless is a cloud execution model that enables a simpler, more cost-effective way to build and operate cloud-native applications.

That's it!

For companies with high traffic and large cloud bills, serverless makes sense. They can save millions of dollars a month.

## GraalVM allows serverless Java for everyone!

I've been playing with GraalVM and the Java frameworks that support it for around 18 months. After doing a lot of research, I blogged about [building native Java apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison).

In September 2021, I did a talk with Josh Long about Spring Native with JHipster at the San Francisco JUG.

https://twitter.com/i/status/1442698739563446276

I flew out on a Monday, we got everything working by Wednesday afternoon, and then spoke about our experience on Wednesday night. I wrote about it in [JHipster Works with Spring Native!](https://www.linkedin.com/pulse/jhipster-works-spring-native-matt-raible/) on LinkedIn and created a [JHipster issue](https://github.com/jhipster/generator-jhipster/issues/16498) to automate our learnings.

## What is Spring Native?

Spring Native provides an API to configure Spring Boot and GraalVM so classes that are not easily discoverable become recognizable. For example, those that are instantiated using reflection. It's a really slick extension to Spring Boot and will likely disappear with Spring Boot 3 because it'll be native by default.

As a result of our successful [presentation at the SF JUG](https://youtu.be/F9oydL_MndA), Josh and I were invited to speak at the Garden State JUG in December. We laid low for a few months and rekindled our research in December. I wrote about it in [JHipster works with Spring Native, Part 2!](https://www.linkedin.com/pulse/jhipster-works-spring-native-part-2-matt-raible/)

## 🔥 Announcing the JHipster Native blueprint!

In late January 2022, we (the JHipster team) upgraded JHipster to use Spring Boot 2.6 and released version [7.6.0](https://www.jhipster.tech/2022/01/23/jhipster-release-7.6.0.html).

In early February, I updated [the Spring Native with JHipster examples](https://github.com/mraible/spring-native-examples) that Josh and I'd been using for research. I was ready to start automating the Spring Native integration using a JHipster module. When [I asked the JHipster team](https://github.com/jhipster/generator-jhipster/issues/16498#issuecomment-1030263905) about the best way to implement it, [Marcelo Shima](https://github.com/mshima) volunteered to create the initial blueprint.

This was on a Friday afternoon (Mountain Time or MT). By the next morning, Marcelo had the MVP finished and provided steps to reproduce our examples. 😳

I was amazed! I remember telling (my partner) Trish that he'd done a week's worth of (my estimated) work in a matter of hours.

Today, I'm proud to announce the [JHipster Native blueprint](https://github.com/jhipster/generator-jhipster-native) is available! Here's how to use it:

```shell
npm install -g generator-jhipster-native
jhipster-native
```

This will generate a JHipster app and integrate GraalVM automatically. You can build and run a native image with the following commands:

```shell
./mvnw package -Pnative,prod -DskipTests
npm run ci:e2e:prepare # start docker dependencies
./target/native-executable
```

> **NOTE:** Gradle is not currently an option. Follow [generator-jhipster-native#24](https://github.com/jhipster/generator-jhipster-native/issues/24) to see when it's supported.

## Go native with Spring Native and GraalVM

To see Spring Native + JHipster in action, let's look at a [previous JHipster app I created for the Auth0 blog](https://auth0.com/blog/full-stack-java-with-react-spring-boot-and-jhipster/). First, clone the example:

```shell
git clone https://github.com/oktadev/auth0-full-stack-java-example.git jhipster-native
cd jhipster-native
```

> **TIP:**
>
> Want results right away? Clone the `spring-native` branch with the changes below already made:
>
> ```
> git clone -b spring-native https://github.com/oktadev/auth0-full-stack-java-example.git jhipster-native
> ```
>
> Then, skip to the [Configure your OpenID Connect identity provider](#configure-your-openid-connect-identity-provider) section to continue.

Install JHipster 7.8.1 and the JHipster Native blueprint:

```shell
npm i -g generator-jhipster@7.8.1
npm i -g generator-jhipster-native@1.1.2
```

Then, remove all the existing project files and regenerate them. The `jhipster-native` command includes parameters to disable caching because it's not supported by Spring Native, yet.

```shell
rm -rf *
jhipster-native --with-entities --cache-provider no --no-enable-hibernate-cache
# When prompted to overwrite .gitignore, type "a" to overwrite all files
```

If you open the project in IntelliJ IDEA, you can use the **Commit Tools Window** (<kbd>&#8984;</kbd>+<kbd>0</kbd> on macOS or <kbd>Ctrl</kbd>+<kbd>0</kbd> on Linux/Windows) to view files that changed.

{% img {src: "spring-native-jhipster/commit-tools-window.jpg", alt: "IntelliJ IDEA's Commit Tools Window,align=center"} %}

Next, run the following `git checkout` commands to restore the files that were modified in the original example.

```shell
git checkout .gitignore
git checkout README.md
git checkout demo.adoc
git checkout flickr2.jdl
git checkout screenshots
git checkout src/main/webapp/app/entities/photo/photo.tsx
git checkout src/main/webapp/app/entities/photo/photo-update.tsx
git checkout src/main/java/com/auth0/flickr2/config/SecurityConfiguration.java
git checkout src/main/resources/config/application-heroku.yml
git checkout src/main/resources/config/bootstrap-heroku.yml
git checkout Procfile
git checkout system.properties
```

If you'd rather not use the command line, you can right-click on each file and select **Rollback**.

{% img {src: "spring-native-jhipster/rollback-commit.jpg", alt: "Rollback..."} %}

If you ran the `git checkout` commands, there are several changes I made in the first tutorial that'll need to be re-applied:

1. In `src/main/resources/config/application-dev.yml`, remove the `faker` profile for Liquibase.
2. In `pom.xml`, re-add Drew Noake's `metadata-extractor` library:

   ```xml
   <dependency>
       <groupId>com.drewnoakes</groupId>
       <artifactId>metadata-extractor</artifactId>
       <version>2.16.0</version>
   </dependency>
   ```
3. Next, modify the `createPhoto()` method in `src/main/java/com/auth0/flickr2/web/rest/PhotoResource.java` to set the metadata when an image is uploaded.

   ```java
   import com.drew.imaging.ImageMetadataReader;
   import com.drew.imaging.ImageProcessingException;
   import com.drew.metadata.Metadata;
   import com.drew.metadata.MetadataException;
   import com.drew.metadata.exif.ExifSubIFDDirectory;
   import com.drew.metadata.jpeg.JpegDirectory;

   import javax.xml.bind.DatatypeConverter;
   import java.io.BufferedInputStream;
   import java.io.ByteArrayInputStream;
   import java.io.IOException;
   import java.io.InputStream;

   import java.time.Instant;
   import java.util.Date;

   public class PhotoResource {
       ...

       public ResponseEntity<Photo> createPhoto(@Valid @RequestBody Photo photo) throws URISyntaxException {
           log.debug("REST request to save Photo : {}", photo);
           if (photo.getId() != null) { ... }

           try {
               photo = setMetadata(photo);
           } catch (ImageProcessingException | IOException | MetadataException ipe) {
               log.error(ipe.getMessage());
           }

           Photo result = photoRepository.save(photo);
           ...
       }

       private Photo setMetadata(Photo photo) throws ImageProcessingException, IOException, MetadataException {
           String str = DatatypeConverter.printBase64Binary(photo.getImage());
           byte[] data2 = DatatypeConverter.parseBase64Binary(str);
           InputStream inputStream = new ByteArrayInputStream(data2);
           BufferedInputStream bis = new BufferedInputStream(inputStream);
           Metadata metadata = ImageMetadataReader.readMetadata(bis);
           ExifSubIFDDirectory directory = metadata.getFirstDirectoryOfType(ExifSubIFDDirectory.class);

           if (directory != null) {
               Date date = directory.getDateDigitized();
               if (date != null) {
                   photo.setTaken(date.toInstant());
               }
           }

           if (photo.getTaken() == null) {
               log.debug("Photo EXIF date digitized not available, setting taken on date to now...");
               photo.setTaken(Instant.now());
           }

           photo.setUploaded(Instant.now());

           JpegDirectory jpgDirectory = metadata.getFirstDirectoryOfType(JpegDirectory.class);
           if (jpgDirectory != null) {
               photo.setHeight(jpgDirectory.getImageHeight());
               photo.setWidth(jpgDirectory.getImageWidth());
           }

           return photo;
       }
       ...
   }
   ```
4. Install the React libraries needed:

   ```shell
   npm i react-photo-album react-images
   ```

   > **IMPORTANT:**
   >
   > In the previous tutorial, I used `react-photo-gallery`. I switched to `react-photo-album` because [it supports React 17](https://github.com/neptunian/react-photo-gallery/issues/205#issuecomment-1086995379). Because of this, you'll also need to update `src/main/webapp/app/entities/photo/photo.tsx`.
   >
   > 1. Change `import Gallery from 'react-photo-gallery'` to `import PhotoAlbum from 'react-photo-album'`.
   > 2. Change `<Gallery photos={photoSet} onClick={openLightbox} />` to `<PhotoAlbum photos={photoSet} layout="rows" onClick={openLightbox} />`.
5. In `src/test/javascript/cypress/integration/entity/photo.spec.ts`, remove the code that sets the calculated data in the `should create an instance of Photo` test:

   ```typescript
   cy.get(`[data-cy="height"]`).type('99459').should('have.value', '99459');
   cy.get(`[data-cy="width"]`).type('61514').should('have.value', '61514');
   cy.get(`[data-cy="taken"]`).type('2021-10-11T16:46').should('have.value', '2021-10-11T16:46');
   cy.get(`[data-cy="uploaded"]`).type('2021-10-11T15:23').should('have.value', '2021-10-11T15:23');
   ```

Then, you'll need to add type hints for Drew Noake's EXIF processing library in `src/main/java/com/auth0/flickr2/Flickr2App.java`:

```java
@org.springframework.nativex.hint.TypeHint(
    types = {
        ...
        com.drew.metadata.exif.ExifIFD0Directory.class,
        com.drew.metadata.exif.ExifSubIFDDirectory.class,
        com.drew.metadata.exif.ExifThumbnailDirectory.class,
        com.drew.metadata.exif.makernotes.AppleMakernoteDirectory.class,
        com.drew.metadata.exif.GpsDirectory.class,
})
@org.springframework.nativex.hint.NativeHint(options = "-H:+AddAllCharsets")
```

The `@NativeHint(options = "-H:+AddAllCharsets")` solves the following exception that happens when you upload a photo:

```
Caused by: java.nio.charset.UnsupportedCharsetException: Cp1252
    at java.nio.charset.Charset.forName(Charset.java:528) ~[native-executable:na]
    at com.drew.lang.Charsets.<clinit>(Charsets.java:40) ~[na:na]
```

Once you've made all the changes (or cloned the `spring-native` branch), you can build your hip native binary.

### Build a native JHipster app

You will need a JDK with GraalVM and its `native-image` compiler. Using SDKMAN, run the following command and set it as the default:

```shell
sdk install java 22.0.0.2.r17-grl
```

Then, use Maven to build the project. Skip tests since there's no support for Mockito at this time.

```shell
./mvnw package -Pnative,prod -DskipTests
```

This process will take a few minutes to complete.

### Configure your OpenID Connect identity provider

When you generate a JHipster app with OAuth 2.0 / OIDC for authentication, it defaults to using Keycloak. It creates a `src/main/docker/keycloak.yml` file for Docker Compose, as well as a `src/main/docker/realm-config` directory with files to auto-create users and OIDC clients.

If you want to use Keycloak for your running app, start it with the following command:

```shell
docker-compose -f src/main/docker/keycloak.yml up -d
```

If you'd rather use Okta or Auth0, that's possible too!

<a id="use-okta-as-your-identity-provider"></a>
#### Use Okta as your identity provider

{{ macro.cli({type: "jhipster"}) }}

You'll need to source the `.okta.env` file the Okta CLI creates to override the default Spring Security settings.

```shell
source .okta.env
```

> **NOTE:** If you're on Windows, you can modify this file to use `set` instead of `export` and rename it to `okta.bat`. Then, run it with `okta.bat` from the command line.

> **CAUTION:** Modify your existing `.gitignore` file to have `*.env` so you don't accidentally check in your secrets!

_Skip to [Run your native JHipster app](#run-your-native-jhipster-app) if you've configured your app for Okta and just want to see it running._

<a id="use-auth0-as-your-identity-provider"></a>
#### Use Auth0 as your identity provider

To switch from Keycloak to Auth0, override the Spring Security OAuth properties. You don't even need to write any code!

To see how it works, create a `.auth0.env` file in the root of your project, and fill it with the code below to override the default OIDC settings:

```shell
export SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER_URI=https://<your-auth0-domain>/
export SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_CLIENT_ID=<your-client-id>
export SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_CLIENT_SECRET=<your-client-secret>
export JHIPSTER_SECURITY_OAUTH2_AUDIENCE=https://<your-auth0-domain>/api/v2/
```

You'll need to create a new web application in Auth0 and fill in the `<...>` placeholders before this works.

##### Create an OpenID Connect app on Auth0

Log in to your Auth0 account (or [sign up](https://auth0.com/signup) if you don't have an account). You should have a unique domain like `dev-xxx.eu.auth0.com`.

Press the **Create Application** button in the [Applications section](https://manage.auth0.com/#/applications). Use a name like `JHipster Native!`, select `Regular Web Applications`, and click **Create**.

Switch to the **Settings** tab and configure your application settings:

- Allowed Callback URLs: `http://localhost:8080/login/oauth2/code/oidc`
- Allowed Logout URLs: `http://localhost:8080/`

Scroll to the bottom and click **Save Changes**.

Copy your Auth0 domain, client ID, and client secret into the `.auth0.env` file you created earlier. Then, run `source .auth0.env`.

In the [roles](https://manage.auth0.com/#/roles) section, create new roles named `ROLE_ADMIN` and `ROLE_USER`.

Create a new user account in the [users](https://manage.auth0.com/#/users) section. Click on the **Role** tab to assign the roles you just created to the new account.

_Make sure your new user's email is verified before attempting to log in!_

Next, head to **Auth Pipeline** > **Rules** > **Create**. Select the `Empty rule` template. Provide a meaningful name like `Group claims` and replace the Script content with the following.

```js
function(user, context, callback) {
  user.preferred_username = user.email;
  const roles = (context.authorization || {}).roles;

  function prepareCustomClaimKey(claim) {
    return `https://www.jhipster.tech/${claim}`;
  }

  const rolesClaim = prepareCustomClaimKey('roles');

  if (context.idToken) {
    context.idToken[rolesClaim] = roles;
  }

  if (context.accessToken) {
    context.accessToken[rolesClaim] = roles;
  }

  callback(null, user, context);
}
```

This code is adding the user's roles to a custom claim (prefixed with `https://www.jhipster.tech/roles`). Click **Save changes** to continue.

> **TIP:** Want to have all these steps automated for you? Add a 👍 to [issue #351](https://github.com/auth0/auth0-cli/issues/351) in the Auth0 CLI project.

### Run your native JHipster app

After you've built your app, it will be available in `target/native-executable`. Start Keycloak or source your Okta/Auth0 settings. Then, run the following commands:

```shell
npm run ci:e2e:prepare # start docker dependencies
./target/native-executable
```

It should start in under a second!

{% img {src: "spring-native-jhipster/native-start.png", alt: "Started Flickr2App in 0.581 seconds", header: "800"} %}

## What does the JHipster Native blueprint do?

The JHipster Native blueprint integrates Spring Native into a JHipster project based on [findings from the research by Josh Long and me](https://github.com/mraible/spring-native-examples#readme). I documented our findings in September and December 2021.

- Sep 30, 2021: [JHipster Works with Spring Native!](https://www.linkedin.com/pulse/jhipster-works-spring-native-matt-raible/)
- Dec 14, 2021: [JHipster works with Spring Native, Part 2!](https://www.linkedin.com/pulse/jhipster-works-spring-native-part-2-matt-raible/)

The unexpected thing is, one of the hardest problems we had to solve was with JPA and relationships. In JVM mode, everything worked fine. When running in native mode, [there was an exception](https://github.com/jhipster/generator-jhipster/issues/17794). The solution took days to figure out, but was quite simple to fix: I just had to add a type hint for `java.util.HashSet.class`. 🤯

During this experience, I was surprised to find that Spring Native [doesn't support caching yet](https://github.com/spring-projects-experimental/spring-native/issues/465). I believe this support will be added by the community soon. In the meantime, if you're looking to start/stop your infra as fast as possible, you probably don't care about caching. Caching is made for long-lived, JVM-strong, JVM-loving apps.

## What's the performance like?

The native binary starts in just over 500ms (577ms) on my 2019 MacBook Pro with a 2.4 GHz 8-Core Intel Core i9 processor and 64 GB of RAM.

If I start it in JVM mode with Maven, it takes a little over four seconds.

{% img {src: "spring-native-jhipster/jvm-start.png", alt: "Started Flickr2App in 4.887 seconds", header: "800"} %}

As far as build time goes, Spring Native says:

```
Finished generating 'native-executable' in 3m 15s.
```

If I build a Docker image with the native binary:

```
mvn spring-boot:build-image -Pprod
```

It takes a while the first time:

```
Total time:  07:24 min
```

And it's slightly faster the second time:

```
Total time:  06:43 min
```

The amount of memory used after starting: `178 MB`.

The amount of memory used after running `npm run e2e`: `211 MB`.

In the interest of full disclosure, here's the command I used to measure the amount of memory used:

```shell
ps -o pid,rss,command | grep --color native | awk '{$2=int($2/1024)" MB";}{ print;}'
```

What about the M1 Max? That's [not an option yet](https://twitter.com/mraible/status/1494417051137585152), but [could be in the next release of GraalVM](https://github.com/oracle/graal/issues/2666#issuecomment-1057819284).

## Learn more about GraalVM and Spring Native

I hope you've enjoyed learning how to make JHipster work with Spring Native and GraalVM. It's still a work-in-progress. Startup time isn't the end-all-be-all metric, but it is important in a serverless environment.

You can find the source code for this example on GitHub in the [@oktadev/auth0-full-stack-java-example repository](https://github.com/oktadev/auth0-full-stack-java-example/tree/spring-native). The source for the JHipster Native blueprint is in the [@jhipster/generator-jhipster-native repository](https://github.com/jhipster/generator-jhipster-native).

JHipster also has Micronaut and Quarkus blueprints. However, their native support is currently a work-in-progress. I hope to help improve them in the next few months.

- [JHipster Quarkus can't build native image](https://github.com/jhipster/generator-jhipster-quarkus/issues/222)
- [JHipster Micronaut can't build native image](https://github.com/jhipster/generator-jhipster-micronaut/issues/115)

If you liked this post, there's a good chance you'll like similar ones:

- [Watch GraalVM turn your Java into binaries](/blog/2019/11/27/graalvm-java-binaries)
- [Spring Native in Action with the Okta Spring Boot Starter](/blog/2021/09/16/spring-native-okta-starter)
- [Build Native Java Apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison)
- [Build REST APIs and Native Java Apps with Helidon](/blog/2022/01/06/native-java-helidon)

If you have questions, please ask them in the comments below! If you're into social media, follow us: [@oktadev on Twitter](https://twitter.com/oktadev), [Okta for Developers on LinkedIn](https://www.linkedin.com/company/oktadev), and [OktaDev](https://www.facebook.com/oktadevelopers) on Facebook. If you like learning via video, subscribe to [our YouTube channel](https://youtube.com/oktadev).
