---
disqus_thread_id: 8046868969
discourse_topic_id: 17249
discourse_comment_url: https://devforum.okta.com/t/17249
title: "Angular Deployment with a Side of Spring Boot"
author: matt-raible
by: advocate
communities: [java,javascript,devops]
description: "Learn how to deploy your Angular + Spring Boot App to Heroku, Firebase, Netlify, and AWS."
tags: [angular, deployment, heroku, firebase, netlify, aws-s3]
tweets:
- "You've built an Angular + Spring Boot application and now you need to deploy it. This tutorial shows you how!"
- "Deploy @angular to Heroku, Firebase, Netlify, and AWS with this in-depth tutorial."
- "A Guide for deploying @angular and @springboot applications in 2020. 👇"
image: angular-deployment/angular-deployment.png
type: conversion
update-title: The Angular Mini-Book
update-url: https://www.infoq.com/minibooks/angular-mini-book/
update-extra: Its "Angular Deployment" chapter was inspired by this blog post.
changelog:
  - 2021-11-21: Added announcement about [The Angular Mini-Book](https://www.infoq.com/minibooks/angular-mini-book/). Its "Angular Deployment" chapter was inspired by this blog post.
  - 2020-06-18: Updated to Spring Boot 2.3.1, Angular 9.1.11, and the latest [Okta Heroku Add-on](https://elements.heroku.com/addons/okta). See the code changes in the [example app on GitHub](https://github.com/oktadeveloper/okta-angular-deployment-example/pull/2). Changes to this article can be viewed in [oktadeveloper/okta-blog#328](https://github.com/oktadeveloper/okta-blog/pull/328).
---
One of the more popular combinations of frontend and backend frameworks is Angular + Spring Boot. I've written several tutorials about how to combine the two—from keeping them as separate apps to combining them into a single artifact. But, what about deployment?

Developers ask me from time-to-time, "What's the best way to do Angular  deployment?" In this tutorial, I'll show you several options. I'll start by showing you how to deploy a Spring Boot app to Heroku. Then, I'll show how to deploy a separate Angular app to Heroku.

There are lots of tutorials and information in the Java community on how to deploy Spring Boot apps, so I'll leave the Spring Boot API on Heroku and show other Angular deployment options, including Firebase, Netlify, and AWS S3.

{% img {src: "angular-deployment/angular-deployment.png", alt: "Angular Deployment with a Side of Spring Boot", header: "800"} %}

[[toc]]

You can also [watch this tutorial as a screencast](https://youtu.be/Hx9SbQ1ANLk). 👇

{% youtube "Hx9SbQ1ANLk" %}

<a id="create-an-angular-spring-boot-app"></a>
## Create an Angular + Spring Boot App

Since this tutorial is more about deployment than app creation, you can start with an existing Angular + Spring Boot app that I created previously. It's a note-taking app that uses Kotlin and Spring Boot 2.2 on the backend and Angular 9 on the frontend. It's secured with OpenID Connect (OIDC). If you'd like to see how I built it, you can read the following tutorials:

- [Build a CRUD App with Angular 9 and Spring Boot 2.2](/blog/2020/01/06/crud-angular-9-spring-boot-2)
- [Build Beautiful Angular Apps with Bootstrap](/blog/2020/03/02/angular-bootstrap)

One of the slick features of this app is its full-featured data table that allows sorting, searching, and pagination. This feature is powered by NG Bootstrap and Spring Data JPA. Below is a screenshot:

{% img {src: "angular-deployment/notes-list-with-sorting.png", alt: "Notes list with sorting", header: "800"} %}

Clone the application into an `okta-angular-deployment-example` directory.

```shell
git clone https://github.com/oktadeveloper/okta-angular-bootstrap-example.git \
 okta-angular-deployment-example
```

**Prerequisites:**

- [Java 11](https://adoptopenjdk.net/)+
- [Node 12](https://nodejs.org/)+
- [Docker](https://docs.docker.com/get-docker/)
- An [Okta Developer Account](https://developer.okta.com/signup/)

<a id="secure-your-angular-spring-boot-app-with-oidc"></a>
### Secure Your Angular + Spring Boot App with OIDC

To begin, you'll need to [create a Heroku account](https://signup.heroku.com/login). If you already have a Heroku account, [log in to it](https://id.heroku.com/login). Once you're logged in, create a new app. I named mine `bootiful-angular`.

{% img {src: "angular-deployment/heroku-create-app.png", alt: "Create Heroku app", header: "700"} %}

After creating your app, click on the **Resources** tab and add the **Okta** add-on.

{% img {src: "angular-deployment/okta-add-on.png", alt: "Okta Add-On", header: "475"} %}

> **CAUTION:** If you haven't entered a credit card for your Heroku account, you will receive an error. This is because Heroku requires you to have a credit card on file to use any of their add-ons, even for free ones. This is part of Heroku's assurance to guard against misuse (real person, real credit card, etc.). I think this is a good security practice. Simply add a credit card to continue.

Click **Provision** and wait 20-30 seconds while your Okta account is created and OIDC apps are registered. Now go to your app's **Settings** tab and click the **Reveal Config Vars** button. The Config Vars displayed are the environment variables you can use to configure both Angular and Spring Boot for OIDC authentication.

{% img {src: "angular-deployment/heroku-config-vars.png", alt: "Okta Add-On", header: "800"} %}

Create an `okta.env` file in the `okta-angular-deployment-example/notes-api` directory and copy the config vars into it, where `$OKTA_*` is the value from Heroku.

```shell
export OKTA_OAUTH2_ISSUER=$OKTA_OAUTH2_ISSUER
export OKTA_OAUTH2_CLIENT_ID=$OKTA_OAUTH2_CLIENT_ID_WEB
export OKTA_OAUTH2_CLIENT_SECRET=$OKTA_OAUTH2_CLIENT_SECRET_WEB
```

> **NOTE:**
>
> If you're on Windows without [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10) installed, create an `okta.bat` file and use `SET` instead of `export`.

Start your Spring Boot app by navigating to the `notes-api` directory, sourcing this file, and running `./gradlew bootRun`.

```shell
source okta.env
./gradlew bootRun
```

> **TIP: Environment Variables in IntelliJ IDEA**
>
> If you're using IntelliJ IDEA, you can copy the contents of `okta.env` and paste its values as environment variables. Edit the **DemoApplication** configuration and click on the **Browse** icon on the right-side of **Environment variables**.
>
> {% img {src: "angular-deployment/idea-edit-configuration.png", alt: "Edit DemoApplication Configuration", header: "800"} %}
>
> Next, click the paste icon. You'll need to delete `export` in the Name column. Now you can run your Spring Boot app with Okta from IDEA!
>
> {% img {src: "angular-deployment/idea-env-variables.png", alt: "IntelliJ Environment Variables", header: "600"} %}

Next, configure Angular for OIDC authentication by modifying its `auth-routing.module.ts` to use the generated issuer, client ID, and update the callback URL.

**notes/src/app/auth-routing.module.ts**

```typescript
const oktaConfig = {
  issuer: '$OKTA_OAUTH2_ISSUER',
  redirectUri: window.location.origin + '/callback',
  clientId: '$OKTA_OAUTH2_CLIENT_ID_SPA',
  pkce: true
};

const routes: Routes = [
  ...
  {
    path: '/callback',
    component: OktaCallbackComponent
  }
];
```

Install your Angular app's dependencies and start it.

```shell
npm i
ng serve
```

Open `http://localhost:4200` in your browser.

{% img {src: "angular-deployment/angular-home.png", alt: "Angular Home", header: "800"} %}

Click the **Login** button in the top right corner. You should be logged in straight-away, since you're already logged in to Okta. If you want to see the full authentication flow, log out, or try it in a private window. You can use the `$OKTA_ADMIN_EMAIL` and `$OKTA_ADMIN_PASSWORD` from your Heroku config variables for credentials. Create a note to make sure everything works.

{% img {src: "angular-deployment/first-note.png", alt: "First note", header: "800"} %}

Commit your progress to Git from the top-level `okta-angular-deployment-example` directory.

```shell
git commit -am "Add Okta OIDC Configuration"
```

<a id="prepare-angular-spring-boot-for-production"></a>
## Prepare Angular + Spring Boot for Production

There are a couple of things you should do to make your app ready for production.

1. Make sure you're using the latest releases
2. Configure production URLs
3. Use PostgreSQL for the production database

You're going to want to continue to develop locally—so you'll want a production mode as well as a development mode.

### Update Spring Boot and Angular Dependencies

I'm the type of developer that likes to use the latest releases of open source libraries. I do this to take advantage of new features, performance optimizations, and security fixes.

There's a [Gradle Use Latest Versions Plugin](https://github.com/patrikerdes/gradle-use-latest-versions-plugin) that provides a task to update dependencies to the latest version. Configure it by adding the following to the `plugins` block at the top of `notes-api/build.gradle.kts`.

```kotlin
plugins {
    id("se.patrikerdes.use-latest-versions") version "0.2.13"
    id("com.github.ben-manes.versions") version "0.28.0"
    ...
}
```

For compatibility with Spring Boot 2.3, you'll need to update the Gradle Wrapper to use Gradle 6.3+.

```shell
./gradlew wrapper --gradle-version=6.5 --distribution-type=bin
```

Then run the following command in the `notes-api` directory to update your dependencies to the latest released versions.

```shell
./gradlew useLatestVersions
```

You can verify everything still works by running `./gradlew bootRun` and navigating to `http://localhost:8080/api/notes`. You should be redirected to Okta to log in, then back to your app.

> **TIP:** If your app fails to start, you need to run `source okta.env` first.

For the Angular client, you can use [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) to upgrade npm dependencies.

```shell
npm i -g npm-check-updates
ncu -u
```

At the time of this writing, this will upgrade Angular to version 9.1.9 and TypeScript to version 3.9.3. Angular 9 supports TypeScript versions >=3.6.4 and <3.9.0, so you'll need to change `package.json` to specify TypeScript 3.8.3.

```json
"typescript": "~3.8.3"
```

Then run the following commands in the `notes` directory:

```shell
npm i
npm audit fix
ng serve
```

Confirm you can still log in at `http://localhost:4200`.

Commit all your changes to source control.

```shell
git commit -am "Update dependencies to latest versions"
```

### Configure Production URLs

There are a few places where `localhost` is hard-coded:

1. `notes-api/src/main/kotlin/.../DemoApplication.kt` has `http://localhost:4200`
2. `notes/src/app/shared/okta/auth-interceptor.ts` has `http://localhost`
3. `notes/src/app/note/note.service.ts` has `http://localhost:8080`

You need to change Spring Boot's code so other origins can make CORS requests too. Angular's code needs updating so access tokens will be sent to production URLs while API requests are sent to the correct endpoint.

Open the root directory in your favorite IDE and configure it so it loads `notes-api` as a Gradle project. Open `DemoApplication.kt` and change the `simpleCorsFilter` bean so it configures the allowed origins from your Spring environment.

**notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt**

```kotlin
import org.springframework.beans.factory.annotation.Value

@SpringBootApplication
class DemoApplication {

    @Value("#{ @environment['allowed.origins'] ?: {} }")
    private lateinit var allowedOrigins: List<String>

    @Bean
    fun simpleCorsFilter(): FilterRegistrationBean<CorsFilter> {
        val source = UrlBasedCorsConfigurationSource()
        val config = CorsConfiguration()
        config.allowCredentials = true
        config.allowedOrigins = allowedOrigins
        config.allowedMethods = listOf("*");
        config.allowedHeaders = listOf("*")
        source.registerCorsConfiguration("/**", config)
        val bean = FilterRegistrationBean(CorsFilter(source))
        bean.order = Ordered.HIGHEST_PRECEDENCE
        return bean
    }
}
```

Define the `allowed.origins` property in `notes-api/src/main/resources/application.properties`.

```properties
allowed.origins=http://localhost:4200
```

Angular has an [environment concept](https://angular.io/guide/build) built-in. When you run `ng build --prod` to create a production build, it replaces `environment.ts` with `environment.prod.ts`.

Open `environment.ts` and add an `apiUrl` variable for development.

**notes/src/environments/environment.ts**

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};
```

Edit `environment.prod.ts` to point to your production Heroku URL. Be sure to replace `bootiful-angular` with your app's name.

**notes/src/environments/environment.prod.ts**

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://bootiful-angular.herokuapp.com'
};
```

Update `auth-interceptor.ts` to use `environment.apiUrl`.

**notes/src/app/shared/okta/auth.interceptor.ts**

```typescript
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  ...

  private async handleAccess(request: HttpRequest<any>, next: HttpHandler): Promise<HttpEvent<any>> {
    const allowedOrigins = [environment.apiUrl];
    ...
  }
}
```

Update `notes.service.ts` as well.

**notes/src/app/note/note.service.ts**

```typescript
import { environment } from '../../environments/environment';
...

export class NoteService {
  ...
  api = `${environment.apiUrl}/api/notes`;
  ...

  find(filter: NoteFilter): Observable<Note[]> {
    ...

    const userNotes = `${environment.apiUrl}/user/notes`;
    ...
  }
}
```

### Use PostgreSQL for the Production Database

H2 is a SQL database that works nicely for development. In production, you're going to want something a little more robust. Personally, I like PostgreSQL so I'll use it in this example.

Similar to Angular's environments, Spring and Maven have profiles that allow you to enable different behavior for different environments.

Open `notes-api/build.gradle.kts` and change the H2 dependency so PostgreSQL is used when `-Pprod` is passed in.

```kotlin
if (project.hasProperty("prod")) {
    runtimeOnly("org.postgresql:postgresql")
} else {
    runtimeOnly("com.h2database:h2")
}
```

At the bottom of the file, add the following code to make the `prod` profile the default when `-Pprod` is included in Gradle commands.

```kotlin
val profile = if (project.hasProperty("prod")) "prod" else "dev"

tasks.bootRun {
    args("--spring.profiles.active=${profile}")
}

tasks.processResources {
    rename("application-${profile}.properties", "application.properties")
}
```

Rename `notes-api/src/main/resources/application.properties` to `application-dev.properties` and add a URL for H2 so it will persist to disk, which retains data through restarts.

```properties
allowed.origins=http://localhost:4200
spring.datasource.url=jdbc:h2:file:./build/h2db/notes;DB_CLOSE_DELAY=-1
```

Create a `notes-api/src/main/docker/postgresql.yml` so you can test your `prod` profile settings.

```yaml
version: '2'
services:
  notes-postgresql:
    image: postgres:12.1
    environment:
      - POSTGRES_USER=notes
      - POSTGRES_PASSWORD=
    ports:
      - 5432:5432
```

Create an `application-prod.properties` file in the same directory as `application-dev.properties`. You'll override these properties with environment variables when you deploy to Heroku.

**notes-api/src/main/resources/application-prod.properties**

```properties
allowed.origins=http://localhost:4200
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.datasource.url=jdbc:postgresql://localhost:5432/notes
spring.datasource.username=notes
spring.datasource.password=
```

The word `user` is a keyword in PostgreSQL, so you'll need to change `user` to `username` in the `Note` entity.

**notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt**

```kotlin
data class Note(@Id @GeneratedValue var id: Long? = null,
                var title: String? = null,
                var text: String? = null,
                @JsonIgnore var username: String? = null)
```

This will cause compilation errors and you'll need to rename method names and variables to fix them.

<details>
<summary>Click to see the diff</summary>

```diff
diff --git a/notes-api/src/main/kotlin/com/okta/developer/notes/DataInitializer.kt b/notes-api/src/main/kotlin/com/okta/developer/notes/DataInitializer.kt
index 387e332..506d761 100644
--- a/notes-api/src/main/kotlin/com/okta/developer/notes/DataInitializer.kt
+++ b/notes-api/src/main/kotlin/com/okta/developer/notes/DataInitializer.kt
@@ -10,7 +10,7 @@ class DataInitializer(val repository: NotesRepository) : ApplicationRunner {
     @Throws(Exception::class)
     override fun run(args: ApplicationArguments) {
         for (x in 0..1000) {
-            repository.save(Note(title = "Note ${x}", user = "matt.raible@okta.com"))
+            repository.save(Note(title = "Note ${x}", username = "matt.raible@okta.com"))
         }
         repository.findAll().forEach { println(it) }
     }
diff --git a/notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt b/notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt
index 6f1292c..22a5130 100644
--- a/notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt
+++ b/notes-api/src/main/kotlin/com/okta/developer/notes/DemoApplication.kt
@@ -26,12 +26,12 @@ fun main(args: Array<String>) {
 data class Note(@Id @GeneratedValue var id: Long? = null,
                 var title: String? = null,
                 var text: String? = null,
-                @JsonIgnore var user: String? = null)
+                @JsonIgnore var username: String? = null)

 @RepositoryRestResource
 interface NotesRepository : JpaRepository<Note, Long> {
-    fun findAllByUser(name: String, pageable: Pageable): Page<Note>
-    fun findAllByUserAndTitleContainingIgnoreCase(name: String, title: String, pageable: Pageable): Page<Note>
+    fun findAllByUsername(name: String, pageable: Pageable): Page<Note>
+    fun findAllByUsernameAndTitleContainingIgnoreCase(name: String, title: String, pageable: Pageable): Page<Note>
 }

 @Component
@@ -42,6 +42,6 @@ class AddUserToNote {
     fun handleCreate(note: Note) {
         val username: String = SecurityContextHolder.getContext().getAuthentication().name
         println("Creating note: $note with user: $username")
-        note.user = username
+        note.username = username
     }
 }
diff --git a/notes-api/src/main/kotlin/com/okta/developer/notes/UserController.kt b/notes-api/src/main/kotlin/com/okta/developer/notes/UserController.kt
index 0f71858..670fedd 100644
--- a/notes-api/src/main/kotlin/com/okta/developer/notes/UserController.kt
+++ b/notes-api/src/main/kotlin/com/okta/developer/notes/UserController.kt
@@ -15,10 +15,10 @@ class UserController(val repository: NotesRepository) {
     fun notes(principal: Principal, title: String?, pageable: Pageable): Page<Note> {
         println("Fetching notes for user: ${principal.name}")
         return if (title.isNullOrEmpty()) {
-            repository.findAllByUser(principal.name, pageable)
+            repository.findAllByUsername(principal.name, pageable)
         } else {
             println("Searching for title: ${title}")
-            repository.findAllByUserAndTitleContainingIgnoreCase(principal.name, title, pageable)
+            repository.findAllByUsernameAndTitleContainingIgnoreCase(principal.name, title, pageable)
         }
     }
```

</details>

You won't want to pre-populate your production database with a bunch of notes, so add a `@Profile` annotation to the top of `DataInitializer` so it only runs for the `dev` profile.

```kotlin
import org.springframework.context.annotation.Profile
...

@Profile("dev")
class DataInitializer(val repository: NotesRepository) : ApplicationRunner {...}
```

To test your profiles, start PostgreSQL using Docker Compose.

```shell
docker-compose -f src/main/docker/postgresql.yml up
```

> **CAUTION:** If you have PostreSQL installed and running locally, you'll need to stop the process for Docker Compose to work.

In another terminal, run your Spring Boot app.

```shell
source okta.env
./gradlew bootRun -Pprod
```

If it starts OK, confirm your Angular app can talk to it and get ready to deploy to production!

```shell
git commit -am "Configure environments for production"
```

## Deploy Spring Boot to Heroku

One of the easiest ways to interact with Heroku is with the Heroku CLI. [Install it](https://devcenter.heroku.com/articles/heroku-cli) before proceeding with the instructions below.

```shell
brew tap heroku/brew && brew install heroku
```

Open a terminal and log in to your Heroku account.

```shell
heroku login
```

Heroku expects you to have one Git repo per application. However, in this particular example, there are multiple apps in the same repo. This is called a "monorepo", where many projects are stored in the same repository.

Luckily, there's a [heroku-buildpack-monorepo](https://elements.heroku.com/buildpacks/lstoll/heroku-buildpack-monorepo) that allows you to deploy multiple apps from the same repo.

You should already have a Heroku app that you added Okta to. Let's use it for hosting Spring Boot. Run `heroku apps` and you'll see the one you created.

```shell
$ heroku apps
=== matt.raible@okta.com Apps
bootiful-angular
```

You can run `heroku config -a $APP_NAME` to see your Okta variables. In my case, I'll be using `bootiful-angular` for `$APP_NAME`.

Associate your existing Git repo with the app on Heroku.

```shell
heroku git:remote -a $APP_NAME
```

Set the `APP_BASE` config variable to point to the `notes-api` directory. While you're there, add the monorepo and Gradle buildpacks.

```shell
heroku config:set APP_BASE=notes-api
heroku buildpacks:add https://github.com/lstoll/heroku-buildpack-monorepo
heroku buildpacks:add heroku/gradle
```

Attach a PostgreSQL database to your app.

```shell
heroku addons:create heroku-postgresql
```

As part of this process, Heroku will create a `DATASOURCE_URL` configuration variable. It will also automatically detect Spring Boot and set variables for `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, AND `SPRING_DATASOURCE_PASSWORD`. These values will override what you have in `application-prod.properties`.

By default, [Heroku's Gradle support](https://devcenter.heroku.com/articles/deploying-gradle-apps-on-heroku) runs `./gradlew build -x test`. Since you want it to run `./gradlew bootJar -Pprod`, you'll need to override it by setting a `GRADLE_TASK` config var.

```shell
heroku config:set GRADLE_TASK="bootJar -Pprod"
```

The `$OKTA_*` environment variables don't have the same names as the Okta Spring Boot starter expects. This is because the Okta Heroku Add-On creates two apps: SPA and web. The web app's config variables end in `_WEB`. You'll have to make some changes so those variables are used for the Okta Spring Boot starter. One way to do so is to create a `Procfile` in the `notes-api` directory.

```shell
web: java -Dserver.port=$PORT -Dokta.oauth2.client-id=${OKTA_OAUTH2_CLIENT_ID_WEB} -Dokta.oauth2.client-secret=${OKTA_OAUTH2_CLIENT_SECRET_WEB} -jar build/lib/*.jar
```

I think it's easier to rename the variable, so that's what I recommend. Run the following command and remove `_WEB` from the two variables that have it.

```shell
heroku config:edit
```

Now you're ready to deploy! Take a deep breath and witness how Heroku can deploy your Spring Boot + Kotlin app with a simple `git push`.

```shell
git push heroku master
```

When I ran this command, I received this output:

```shell
remote: Compressing source files... done.
remote: Building source:
remote:
remote: -----> Monorepo app detected
remote:       Copied notes-api to root of app successfully
remote: -----> Gradle app detected
remote: -----> Spring Boot detected
remote: -----> Installing JDK 1.8... done
remote: -----> Building Gradle app...
remote: -----> executing ./gradlew bootJar -Pprod
remote:        Downloading https://services.gradle.org/distributions/gradle-6.0.1-bin.zip
remote:        ..........................................................................................
remote:        > Task :compileKotlin
remote:        > Task :compileJava NO-SOURCE
remote:        > Task :processResources
remote:        > Task :classes
remote:        > Task :bootJar
remote:
remote:        BUILD SUCCESSFUL in 1m 28s
remote:        3 actionable tasks: 3 executed
remote: -----> Discovering process types
remote:        Procfile declares types     -> (none)
remote:        Default types for buildpack -> web
remote:
remote: -----> Compressing...
remote:        Done: 91.4M
remote: -----> Launching...
remote:        Released v1
remote:        https://bootiful-angular.herokuapp.com/ deployed to Heroku
remote:
remote: Verifying deploy... done.
To https://git.heroku.com/bootiful-angular.git
   a1b10c4..6e298cf  master -> master
Execution time: 2 min. 7 s.
```

Run `heroku open` to open your app. You'll be redirected to Okta to authenticate, then back to your app. It will display a 404 error message because you have nothing mapped to `/`. You can fix that by adding a `HomeController` with the following code.

```kotlin
package com.okta.developer.notes

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HomeController {

    @GetMapping("/")
    fun hello(@AuthenticationPrincipal user: OidcUser): String {
        return "Hello, ${user.fullName}"
    }
}
```

Commit this change and deploy it to Heroku.

```shell
git commit -am "Add HomeController"
git push heroku master
```

Now when you access the app, it should say hello.

{% img {src: "angular-deployment/heroku-hello.png", alt: "Hello", header: "800"} %}

## Deploy Angular to Heroku

An Angular app is composed of JavaScript, CSS, and HTML when built for production. It's extremely portable because it's just a set of static files. If you run `ng build --prod`, the production-ready files will be created in `dist/<app-name>`. In this section, you'll learn how you can use your `package.json` scripts to hook into Heroku's lifecycle and how to deploy them with a simple `git push`.

You'll need to create another app on Heroku for the Angular frontend.

```shell
heroku create
```

Set the `APP_BASE` config variable and add the necessary buildpacks to the app that was just created.

```shell
APP_NAME=<app-name-from-heroku-create>
heroku config:set APP_BASE=notes -a $APP_NAME
heroku buildpacks:add https://github.com/lstoll/heroku-buildpack-monorepo -a $APP_NAME
heroku buildpacks:add heroku/nodejs -a $APP_NAME
```

Change `notes/package.json` to have a different `start` script.

```json
"start": "http-server-spa dist/notes index.html $PORT",
```

Add a `heroku-postbuild` script to your `package.json`:

```json
"heroku-postbuild": "ng build --prod && npm install -g http-server-spa"
```

Commit your changes, add a new Git remote for this app, and deploy!

```shell
git commit -am "Prepare for Heroku"
git remote add angular https://git.heroku.com/$APP_NAME.git
git push angular master
```

When it finishes deploying, you can open your Angular app with:

```shell
heroku open --remote angular
```

> **NOTE:** If you experience any issues, you can run `heroku logs --remote angular` to see your app's log files.

You won't be able to log in to your app until you modify its Login redirect URI on Okta. Log in to your Okta dashboard (tip: you can do this from the first Heroku app you created, under the **Resources** tab). Go to **Applications** > **SPA** > **General** > **Edit**. Add `https://<angular-app-on-heroku>.herokuapp.com/callback` to the Login redirect URIs and `https://<angular-app-on-heroku>.herokuapp.com` to the Logout redirect URIs.

You should be able to log in now, but you won't be able to add any notes. This is because you need to update the allowed origins in your Spring Boot app. Run the following command to add an `ALLOWED_ORIGINS` variable in your Spring Boot app.

```shell
heroku config:set ALLOWED_ORIGINS=https://$APP_NAME.herokuapp.com --remote heroku
```

Now you should be able to add a note. Pat yourself on the back for a job well done!

One issue you'll experience is that you're going to lose your data between restarts. This is because Hibernate is configured to update your database schema each time. Change it to simply validate your schema by overriding the `ddl-auto` value in `application-prod.properties`.

```shell
heroku config:set SPRING_JPA_HIBERNATE_DDL_AUTO=validate --remote heroku
```

## Make Your Angular App More Secure on Heroku

You've deployed your app to Heroku, but there are still a couple of security issues. The first is that if you access it using `http` (instead of `https`), it won't work. You'll get a blank page and an error from the Okta Angular SDK in your browser's console.

The second issue is that you'll score an **F** when you test it using [securityheaders.com](https://securityheaders.com). Heroku has a [blog post on using HTTP headers to secure your site](https://blog.heroku.com/using-http-headers-to-secure-your-site) that will help you improve your score.

Create a `notes/static.json` file with the configuration for secure headers and redirect all HTTP requests to HTTPS.

**notes/static.json**

```json
{
  "headers": {
    "/**": {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; connect-src 'self' https://*.okta.com https://*.herokuapp.com",
      "Referrer-Policy": "no-referrer, strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Feature-Policy": "accelerometer 'none'; camera 'none'; microphone 'none'"
    }
  },
  "https_only": true,
  "root": "dist/notes/",
  "routes": {
    "/**": "index.html"
  }
}
```

For `static.json` to be read, you have to use the [Heroku static buildpack](https://github.com/heroku/heroku-buildpack-static). This buildpack is made for SPA applications, so you can revert the `scripts` section of your `package.json` back to what you had previously. Add `--prod` to the `build` script since the static buildback uses this command.

**notes/package.json**

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build --prod",
  "test": "ng test",
  "lint": "ng lint",
  "e2e": "ng e2e"
},
```

Commit your changes to Git, add the static buildpack, and redeploy your Angular app.

```shell
git add .
git commit -am "Configure secure headers and static buildpack"
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-static.git --remote angular
git push angular master
```

💥 Now you'll have a security report you can be proud of! 😃

{% img {src: "angular-deployment/heroku-headers.png", alt: "Security Report Summary with an A", header: "800"} %}

## Angular Deployment with `ng deploy`

In Angular CLI v8.3.0, an `ng deploy` command was introduced that allows you to automate deploying to many different cloud providers. I thought it'd be fun to try a few of these out and see if it's possible to optimize the headers to get the same **A** rating that you were able to get with Heroku.

Below are the [current providers and packages](https://angular.io/guide/deployment) supported by this command.

| Hosting provider | npm package |
| --- | --- |
| Azure | [`@azure/ng-deploy`](https://npmjs.org/package/@azure/ng-deploy) |
| AWS S3 | [`@jefiozie/ngx-aws-deploy`](https://www.npmjs.com/package/@jefiozie/ngx-aws-deploy) |
| Firebase | [`@angular/fire`](https://npmjs.org/package/@angular/fire) |
| GitHub pages | [`angular-cli-ghpages`](https://npmjs.org/package/angular-cli-ghpages) |
| Netlify | [`@netlify-builder/deploy`](https://www.npmjs.com/package/@netlify-builder/deploy) |
| Now | [`@zeit/ng-deploy`](https://npmjs.org/package/@zeit/ng-deploy) |
| NPM | [`ngx-deploy-npm`](https://npmjs.org/package/ngx-deploy-npm) |

In the following section, I'll show you how to deploy to a few that piqued my interest (Firebase, Netlify, and AWS S3).

### Angular Deployment to Firebase

Create a `firebase` branch so you can make changes without affecting the work you've done for Heroku deployments.

```shell
git checkout -b firebase
```

Open a browser and go to [firebase.google.com](https://firebase.google.com/). Log in to your account, go to the console, and create a new project.

Run `ng add @angular/fire` in the `notes` directory and your new project should show up in the list. Select it to continue.

```shell
? Please select a project: ng-notes-1337 (ng-notes-1337)
CREATE firebase.json (300 bytes)
CREATE .firebaserc (133 bytes)
UPDATE angular.json (3755 bytes)
```

Now you can run `ng deploy` and everything should work.

You'll need to add the project's URL as an allowed origin in your Spring Boot app on Heroku. Copy the printed `Hosting URL` value and run the following command.

```shell
heroku config:edit --remote heroku
```

Add the new URL after your existing Heroku one, separating them with a comma. For example:

```shell
ALLOWED_ORIGINS='https://stark-lake-39546.herokuapp.com,https://ng-notes-1337.web.app'
```

You'll also need to modify your Okta SPA app to add your Firebase URL as a Login redirect URI and Logout redirect URI. For mine, I added:

- Login redirect URI: `https://ng-notes-1337.web.app/callback`
- Logout redirect URI: `https://ng-notes-1337.web.app`

Open your Firebase URL in your browser, log in, and you should be able to see the note you added on Heroku.

### Strong Security Headers on Firebase

If you test your new Firebase site on [securityheaders.com](https://securityheaders.com/), you'll score a **D**. Luckily, you can [configure headers](https://firebase.google.com/docs/hosting/full-config#headers) in your `firebase.json` file. Edit this file and add a `headers` key like the following:

```json
"headers": [ {
  "source": "/**",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; connect-src 'self' https://*.okta.com https://*.herokuapp.com"
    },
    {
      "key": "Referrer-Policy",
      "value": "no-referrer, strict-origin-when-cross-origin"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "X-Frame-Options",
      "value": "DENY"
    },
    {
      "key": "X-XSS-Protection",
      "value": "1; mode=block"
    },
    {
      "key": "Feature-Policy",
      "value": "accelerometer 'none'; camera 'none'; microphone 'none'"
    }
  ]
} ]
```

> **NOTE:** You don't need to include a `Strict-Transport-Security` header because Firebase includes it by default.

Run `ng deploy` and you should get an **A** now!

{% img {src: "angular-deployment/firebase-headers.png", alt: "Firebase app score from securityheaders.com", header: "800"} %}

Commit your changes to your `firebase` branch.

```shell
git add .
git commit -am "Add Firebase deployment"
```

### Angular Deployment to Netlify

Netlify is a hosting provider for static sites that I've enjoyed using in the past. They offer continuous integration, HTML forms, AWS Lambda functions, and CMS functionality. I wrote about Netlify in [Build a Secure Blog with Gatsby, React, and Netlify](/blog/2020/02/18/gatsby-react-netlify).

Check out your `master` branch and create a new `netlify` one.

```shell
git checkout master
git checkout -b netlify
```

Before running the command to add Netlify support, you'll need to [create a Netlify account](https://app.netlify.com/signup). Once you're signed in, create a new site. Netlify makes it easy to connect a site via Git, but since I want to demonstrate `ng deploy`, you'll need to create a temporary directory with an `index.html` file in it. I put "Hello, World" in the HTML file, then dragged the directory into my browser window.

{% img {src: "angular-deployment/netlify-create-site.png", alt: "Netlify create site", header: "650"} %}

Click on **Site Settings** to copy your **API ID** to a text editor. You'll also need a personal access token. To create one, click on your avatar in the top right > **User settings** > **Applications** and click **New access token**. Copy the generated token to your text editor.

Run the command below to add Netlify deployment support.

```shell
ng add @netlify-builder/deploy
```

Copy and paste your API ID and personal access token when prompted, then run `ng deploy` to deploy your site.

Update your Spring Boot app on Heroku to allow your Netlify app URL:

```shell
heroku config:edit --remote heroku
```

Make sure to append the URL to your existing ones, separating them with a comma.

```shell
ALLOWED_ORIGINS='https://stark-lake-39546.herokuapp.com,https://ng-notes-1337.web.app,https://relaxed-brown-0b81d8.netlify.app'
```

You'll also need to update your Okta app to whitelist the URL as a login and logout redirect.

If you try to log in, you'll get a `Page Not Found` error stemming from Okta trying to redirect back to your app. This happens because Netlify doesn't know your app is a SPA that manages its own routes. To fix this, create a `_redirects` file in the `notes/src` directory with the following contents.

```shell
/*    /index.html   200
```

> **TIP:** You can learn more about [configuring Netlify for SPAs in their documentation](https://docs.netlify.com/routing/redirects/rewrites-proxies/#history-pushstate-and-single-page-apps).

Then, modify `angular.json` to include this file in its assets.

```json
"assets": [
  "src/_redirects",
  "src/favicon.ico",
  "src/assets"
],
```

Run `ng deploy` again and you should be able to log in successfully.

### Better Security Headers on Netlify

If you test your new Firebase site on [securityheaders.com](https://securityheaders.com/), you'll score a **D**. Netlify allows you to add [custom headers](https://docs.netlify.com/routing/headers/) to improve your score.

Create a `src/_headers` file with the following contents.

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; connect-src 'self' https://*.okta.com https://*.herokuapp.com
  Referrer-Policy: no-referrer, strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Feature-Policy: accelerometer 'none'; camera 'none'; microphone 'none'
```

> **NOTE:** You don't need to include a `Strict-Transport-Security` header because Netlify includes one by default.

Modify `angular.json` to include this file in its assets.

```json
"assets": [
  "src/_headers",
  "src/_redirects",
  "src/favicon.ico",
  "src/assets"
],
```

Run `ng deploy` and you should get an **A** now!

{% img {src: "angular-deployment/netlify-headers.png", alt: "Netlify score from securityheaders.com", header: "800"} %}

Commit your changes to the `netlify` branch.

```shell
git add .
git commit -am "Add Netlify deployment"
```

> **WARNING:**
>
> The Netlify schematic writes your access token to `angular.json`, which is a security risk (if you push these changes to your source control system).
>
> ```json
> "deploy": {
>   "builder": "@netlify-builder/deploy:deploy",
>   "options": {
>     "outputPath": "dist/notes",
>     "netlifyToken": "04b966f772XXX...",
>     "siteId": "1dda959c-XXXX..."
>   }
> }
> ```
>
> I was notified of this issue by [GitGuardian](https://gitguardian.com/), which we use to monitor our repos. If you check-in this change, make sure to delete the access token on Netlify.

### Angular Deployment to AWS S3

Amazon Simple Storage Service (Amazon S3) is an object storage service that is a popular option for hosting static sites.

Check out your `master` branch and create a new `aws` one.

```shell
git checkout master
git checkout -b aws
```

Before running the command to add S3 deployment support, you'll need a few things:

- An S3 Bucket
- An AWS Region Name
- A Secret Access Key
- An Access Key ID

You'll also need to [create an AWS account](https://portal.aws.amazon.com/billing/signup). After creating an account, go to the [Amazon S3 console](https://s3.console.aws.amazon.com/). Click **Create Bucket** and give it a name you'll remember. Use the default region selected for you and click **Create Bucket**.

To create the secret access key, go to your [security credentials page](https://console.aws.amazon.com/iam/home?nc2=h_m_sc#/security_credentials). Expand the **Access keys** section, and then **Create New Access Key**. Click **Show Access Key** and copy the values into a text editor.

> **TIP:** If you have trouble creating a secret access key, see [this blog post](https://aws.amazon.com/blogs/security/how-to-find-update-access-keys-password-mfa-aws-management-console/).

Add the `@jefiozie/ngx-aws-deploy` package to deploy to S3:

```shell
ng add @jefiozie/ngx-aws-deploy
```

When prompted, enter your region, bucket name, access key, and access key ID. When prompted for the folder, leave it blank.

> **CAUTION:** This process writes these raw values to your `angular.json`. For a more secure setup, use environment variables: `NG_DEPLOY_AWS_ACCESS_KEY_ID`, `NG_DEPLOY_AWS_SECRET_ACCESS_KEY`, `NG_DEPLOY_AWS_BUCKET` and `NG_DEPLOY_AWS_REGION`.

Run `ng deploy` to deploy your Angular app to your AWS S3 bucket.

Next, you need to [configure S3 for static website hosting](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/static-website-hosting.html). Go to your bucket > **Properties** > **Static website hosting**. Take note of the endpoint URL at the top of the card, you'll need this in a minute.

Type `index.html` for the index and error document and click **Save**.

{% img {src: "angular-deployment/aws-static-website.png", alt: "AWS static website", header: "500"} %}

By default, Amazon S3 blocks public access to your buckets. Go to the **Permissions** tab. Click the **Edit** button, clear **Block all public access**, and click **Save**.

The last step you need to do to make it public is add a bucket policy. Go to **Permissions** > **Bucket Policy** and paste the following into the editor, replacing `{your-bucket-name}` with your bucket's name.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::{your-bucket-name}/*"
            ]
        }
    ]
}
```

Click **Save** to continue.

At this point, you could navigate to `https://<bucket-name>.s3.amazonaws.com/index.html` in your browser, and the application will load. However, there's no HTTP to HTTPS redirect or resolution of `index.html` by default. You can [use CloudFront to solve these issues](https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-https-requests-s3/).

Open the [CloudFront console](https://console.aws.amazon.com/cloudfront/) and choose **Create Distribution**. Under the Web section, click the **Get Started** button. Click in the **Origin Domain Name** field and select your S3 bucket.

Set the **Viewer Protocol Policy** to `Redirect HTTP to HTTPS`, allow all HTTP methods, and enter `index.html` as the **Default Root Object**. Scroll to the bottom and click **Create Distribution**. When the Status column changes from `In Progress` to `Deployed`, navigate to the domain name in your browser.

> **NOTE:** Once you've created your distribution, it can take 20 minutes for it to deploy.

After your distribution is deployed, update your Spring Boot app on Heroku to allow your CloudFront URL:

```shell
heroku config:edit --remote heroku
```

Make sure to append the URL to your existing ones, separating them with a comma.

```shell
ALLOWED_ORIGINS='https://stark-lake-39546.herokuapp.com,https://ng-notes-1337.web.app,https://relaxed-brown-0b81d8.netlify.app,https://d2kytj28ukuxfr.cloudfront.net'
```

Update your Okta SPA app to whitelist the URL as a redirect, too.

If you try to log in, you'll get a 403 when redirecting back to the site. To fix this, edit your distribution > **Error pages**. Create two custom error responses for `404` and `403`. Return a path of `/index.html` and a `200: OK` response code.

Now you should be able to authenticate to your Angular app on AWS successfully!

<a id="awesome-security-headers-with-aws-cloudfront-s3"></a>
### Awesome Security Headers with AWS CloudFront + S3

If you test your new CloudFront + S3 site on [securityheaders.com](https://securityheaders.com/), you'll get an **F**. To solve this, you can use [Lambda@Edge to add security headers](https://aws.amazon.com/blogs/networking-and-content-delivery/adding-http-security-headers-using-lambdaedge-and-amazon-cloudfront/).

Go to the [Lambda Console](https://us-west-2.console.aws.amazon.com/lambda/home) and select the `US-East-1 N` region from a drop-down list in the top right. Click **Create Function** to create a new function.

Choose **Author from scratch** and name it `securityHeaders`. Under Permissions, select **Create a new role from AWS Policy templates**. Name the role `securityHeaders-role` and select **Basic Lambda@Edge permissions (for CloudFront trigger)**. Click **Create function**.

In the Function code section, set `index.js` to have the following JavaScript.

```js
exports.handler = (event, context, callback) => {

  // get response
  const response = event.Records[0].cf.response;
  const headers = response.headers;

  // set headers
  headers['content-security-policy'] = [{key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; connect-src 'self' https://*.okta.com https://*.herokuapp.com"}];
  headers['referrer-policy'] = [{key: 'Referrer-Policy', value: 'no-referrer, strict-origin-when-cross-origin'}];
  headers['strict-transport-security'] = [{key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubdomains'}];
  headers['x-content-type-options'] = [{key: 'X-Content-Type-Options', value: 'nosniff'}];
  headers['x-frame-options'] = [{key: 'X-Frame-Options', value: 'DENY'}];
  headers['x-xss-protection'] = [{key: 'X-XSS-Protection', value: '1; mode=block'}];
  headers['feature-policy'] = [{key: 'Feature-Policy', value: "accelerometer 'none'; camera 'none'; microphone 'none'"}];

  // return modified response
  callback(null, response);
};
```

Click **Save** and add a trigger. Select **CloudFront** and **Deploy to Lambda@Edge**. For the distribution, use the ID of your CloudFront distribution. Set the event to be **Origin response**. Select the "I acknowledge..." checkbox and click **Deploy**.

Go back to your CloudFront Console and wait for the deploy to complete.

Try your CloudFront domain again on [securityheaders.com](https://securityheaders.com). You should get an **A** this time.

{% img {src: "angular-deployment/aws-headers.png", alt: "AWS score from securityheaders.com", header: "800"} %}

_Phew! AWS certainly doesn't make things easy._

Commit your changes to the `aws` branch.

```shell
git commit -am "Add AWS S3 deployment"
```

> **WARNING:** If you committed the changes in your `angular.json` file, you should delete your access key in **My Account** > **Security Credentials**. When I made this mistake, Amazon emailed me right away and made me delete my access key and change my password.

## Learn More About Angular and Spring Boot

In this tutorial, you learned how to upgrade Angular and Spring Boot to their latest versions and make them production-ready. You used the [Okta add-on for Heroku](https://devcenter.heroku.com/articles/okta) to add OAuth 2.0 + OIDC to both apps, then deployed them to Heroku. After you got them working on Heroku with PostgreSQL, you learned how to deploy the Angular app to Firebase, Netlify, and AWS.

You learned how to make your Angular app more secure with security headers, force HTTPS, and make each cloud provider SPA-aware. You can find the source code for the completed example in the [@oktadeveloper/okta-angular-deployment-example](https://github.com/oktadeveloper/okta-angular-deployment-example) repository.

This blog post is the third in a series. The first two posts are below.

1. [Build a CRUD App with Angular 9 and Spring Boot 2.2](/blog/2020/01/06/crud-angular-9-spring-boot-2)
2. [Build Beautiful Angular Apps with Bootstrap](/blog/2020/03/02/angular-bootstrap)

I'll be publishing a [4th and final blog post that shows you how to containerize and deploy your Angular + Spring Boot apps with Docker](/blog/2020/06/17/angular-docker-spring-boot). This tutorial will also show how to combine them into a JAR and use server-side authorization code flow (the most secure OAuth 2.0 flow). As icing on the cake, I'll show you how to deploy to Heroku, Knative on Google Cloud, and Cloud Foundry!

If you liked this tutorial, we have several others on Angular and Spring Boot.

- [Build a Beautiful App + Login with Angular Material](/blog/2020/01/21/angular-material-login)
- [Angular + Docker with a Big Hug from Spring Boot](/blog/2020/06/17/angular-docker-spring-boot)
- [What Is Angular Ivy and Why Is It Awesome?](/blog/2020/02/12/angular-ivy)
- [OAuth 2.0 Java Guide: Secure Your App in 5 Minutes](/blog/2019/10/30/java-oauth2)
- [A Quick Guide to Spring Boot Login Options](/blog/2019/05/15/spring-boot-login-options)
- [Build an Application with Spring Boot and Kotlin](/blog/2019/09/17/build-a-spring-boot-kotlin-app)

If you have any questions, please leave a comment below. Follow us on [Twitter](https://twitter.com/oktadev), [LinkedIn](https://www.linkedin.com/company/oktadev), or [Facebook](https://www.facebook.com/oktadevelopers/) to be notified when we publish new tutorials. We have a popular [YouTube channel](https://youtube.com/c/oktadev) too!
