---
layout: docs
title: How to Create an OIDC App on Okta
description: "Manual setup instructions for creating OIDC apps in the Okta Admin Console, and how blog authors generate them with the integrator() macro."
permalink: /blog/integrator-setup/
---

This page is for authors of the Okta Developer Blog. The rendered snippets are also useful for anyone setting up an Okta OIDC app by hand.

[[toc]]

## Use the Admin Console to register your app

To walk readers through creating an application in Okta, call the `integrator()` macro in your post. It renders step-by-step Admin Console instructions for the app type you specify and links to the matching guide in the developer docs. Screenshots are discouraged because they're hard to keep up to date.

Every post can call the macros without importing anything: the build injects `macro` into each post automatically. The macros live in `src/_macros/`.

Two older macros still exist for posts written before May 2025, when the Okta CLI was deprecated: `cli()` renders Okta CLI instructions and `maven()` renders a Maven-based setup that is also deprecated (see #142). Don't use either in new posts. Older posts that rely on them carry the `integrator-org-warning.njk` include, which tells readers the commands no longer work as written.

## Blog post syntax

The basic call for manual setup instructions is:

{% raw %}

```njk
{{ macro.integrator({type: "spa", loginRedirectUri: "http://localhost:3000/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "spa", loginRedirectUri: "http://localhost:3000/callback"}) }}

</div>

## Configuration options

The macro takes one object. Supported values for `type`: `spa`, `web`, `native`, and `service`.

Other keys you can pass:

| Key                 | Possible values                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `framework`         | `Angular`, `React`, `Vue`, `Okta Spring Boot Starter`, `Spring Boot`, `Quarkus`, `ASP.NET Core`. Adjusts the config snippet and the docs link.                       |
| `loginRedirectUri`  | Printed as given. For several URIs, pass one string in the form `[url1,url2]`, and also pass `logoutRedirectUri`: the derived default below only works with a single URI. |
| `logoutRedirectUri` | Printed as given. For `spa` and `web`, defaults to the base of `loginRedirectUri` (everything before `/callback` or `/authorization-code/callback`) when not set. For `native`, always pass it. |
| `signup`            | `"false"` shortens the opening paragraph to a single sign-in sentence.                                                                                               |
| `install`           | `"false"` removes the account sign-up and sign-in sentence entirely.                                                                                                 |
| `note`              | A variable holding Markdown to print right after the Admin Console steps, before the custom-authorization-server steps when both are used. See the ASP.NET Core example. |
| `customAuthServer`  | The ID of a custom authorization server, such as `default`. Adds the access-policy steps and uses the server in the issuer URL. See the last example.                |

`signup` and `install` are compared as strings, so pass `"false"` in quotes. The boolean `false` doesn't match.

## Examples

Examples for different app types and frameworks:

- [Angular](#angular), [React](#react), [Vue](#vue)
- [Node + Express](#node--express)
- [Ionic](#ionic)
- [React Native](#react-native)
- [Okta Spring Boot Starter](#okta-spring-boot-starter)
- [ASP.NET Core](#aspnet-core)
- [Service](#service)
- [OIDC Debugger](#oidc-debugger)
- [Custom Authorization Server](#custom-authorization-server)

### Angular

{% raw %}

```njk
{{ macro.integrator({type: "spa", framework: "Angular", loginRedirectUri: "http://localhost:4200/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "spa", framework: "Angular", loginRedirectUri: "http://localhost:4200/callback"}) }}

</div>

### React

{% raw %}

```njk
{{ macro.integrator({type: "spa", framework: "React", loginRedirectUri: "http://localhost:3000/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "spa", framework: "React", loginRedirectUri: "http://localhost:3000/callback"}) }}

</div>

### Vue

{% raw %}

```njk
{{ macro.integrator({type: "spa", framework: "Vue", loginRedirectUri: "http://localhost:8080/callback", signup: "false"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "spa", framework: "Vue", loginRedirectUri: "http://localhost:8080/callback", signup: "false"}) }}

</div>

### Node + Express

{% raw %}

```njk
{{ macro.integrator({type: "web", loginRedirectUri: "http://localhost:8080/authorization-code/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "web", loginRedirectUri: "http://localhost:8080/authorization-code/callback"}) }}

</div>

### Ionic

{% raw %}

```njk
{{ macro.integrator({type: "native", loginRedirectUri: "[http://localhost:8100/callback,com.okta.dev-133337:/callback]", logoutRedirectUri: "[http://localhost:8100/logout,com.okta.dev-133337:/logout]"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "native", loginRedirectUri: "[http://localhost:8100/callback,com.okta.dev-133337:/callback]", logoutRedirectUri: "[http://localhost:8100/logout,com.okta.dev-133337:/logout]"}) }}

</div>

### React Native

{% raw %}

```njk
{{ macro.integrator({type: "native", loginRedirectUri: "com.okta.dev-133337:/callback", logoutRedirectUri: "com.okta.dev-133337:/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "native", loginRedirectUri: "com.okta.dev-133337:/callback", logoutRedirectUri: "com.okta.dev-133337:/callback"}) }}

</div>

### Okta Spring Boot Starter

{% raw %}

```njk
{{ macro.integrator({type: "web", framework: "Okta Spring Boot Starter"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "web", framework: "Okta Spring Boot Starter"}) }}

</div>

### ASP.NET Core

To print a note after the steps, set a variable first and pass it as `note`:

{% raw %}

```njk
{% set note %}
> Note that the TCP port 5001 must be the same port used by the application. You can see it in the messages displayed in the terminal when you start the application with **`dotnet run`**.
{% endset %}
{{ macro.integrator({type: "web", framework: "ASP.NET Core", note: note, loginRedirectUri: "http://localhost:5001/authorization-code/callback", logoutRedirectUri: "http://localhost:5001/signout/callback"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{% set note %}
> Note that the TCP port 5001 must be the same port used by the application. You can see it in the messages displayed in the terminal when you start the application with **`dotnet run`**.
{% endset %}
{{ macro.integrator({type: "web", framework: "ASP.NET Core", note: note, loginRedirectUri: "http://localhost:5001/authorization-code/callback", logoutRedirectUri: "http://localhost:5001/signout/callback"}) }}

</div>

### Service

{% raw %}

```njk
{{ macro.integrator({type: "service"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "service"}) }}

</div>

### OIDC Debugger

`oidcdebugger()` renders a short paragraph on getting an access token with the OpenID Connect Debugger. It takes an optional `responseType`, which defaults to `code`.

{% raw %}

```njk
{{ macro.oidcdebugger() }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.oidcdebugger() }}

</div>

### Custom Authorization Server

When the post needs a custom authorization server instead of the org's default one, add `customAuthServer`:

{% raw %}

```njk
{{ macro.integrator({type: "spa", framework: "React", loginRedirectUri: "http://localhost:3000/callback", customAuthServer: "default"}) }}
```

{% endraw %}

This renders the following:

<div class="border-l-8 border-okta-cloud pl-6 my-4">

{{ macro.integrator({type: "spa", framework: "React", loginRedirectUri: "http://localhost:3000/callback", customAuthServer: "default"}) }}

</div>
