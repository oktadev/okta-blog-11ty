---
disqus_thread_id: 8079245768
discourse_topic_id: 17251
discourse_comment_url: https://devforum.okta.com/t/17251
title: "Node.js Login with Express and OIDC"
author: matt-raible
by: advocate
communities: [javascript]
description: "This screencast shows you how to create an Express app and add login to it in just a few steps."
tags: [node, javascript, login, oidc, authentication, logout]
tweets:
- "Add login to your @nodejs in just a few minutes!"
- "Do you love adding login to your Node.js apps? Probably not! Learn how to do it with an easy button from @mraible."
- "New to Node.js? Check out how easy it is to add a login feature with @okta!"
image: node-login/nodejs-login.png
type: conversion
---
Node.js just celebrated its 11th birthday on May 27! With the state of things nows, it's pretty crazy to think back to the massive JavaScript Renaissance boost of 2009. In case you're not aware, the JavaScript Renaissance began in around 2004 with Ajax, increased exponentially with jQuery in the mid-2000s, and then really took off with Node.js and a plethora of early JavaScript web frameworks; including Backbone.js, Ember.js, and AngularJS.

Today, I'd like to show you the power of Node.js with a simple login example. Express.js is one of the oldest and most-used server-side MVC frameworks for Node.js. Okta happens to provide an [OIDC Middleware package](https://github.com/okta/okta-oidc-js/tree/master/packages/oidc-middleware#readme) that integrates with Express to secure your app with login and logout functionality.

To show how it all works, I created a screencast: [Node.js Login with Express and OIDC](https://youtu.be/BgpsNi_6mzg).

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" src="https://www.youtube.com/embed/BgpsNi_6mzg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

> **NOTE:** [OktaDev Schematics](https://github.com/oktadeveloper/schematics) was used in the making of this video. See its [Express documentation](https://github.com/oktadeveloper/schematics#express) to reproduce the steps yourself, or follow the instructions below.

{% include "integrator-org-warning.njk" %}

## Create an Express App and Add Login in 5 Steps

**Step 1**: Create a new project with [express-generator](https://expressjs.com/en/starter/generator.html) and pug for the view.

```shell
mkdir express-app
cd express-app
npx express-generator --view=pug
```

**Step 2**: {{ macro.cli({type: "web", list: "true", loginRedirectUri: "http://localhost:3000/callback", logoutRedirectUri: "http://localhost:3000"}) }}

**Step 3**: Install Schematics CLI:

```shell
npm install -g @angular-devkit/schematics-cli
```

**Step 4**: Install and run OktaDev Schematics with your Okta values for `$issuer`, `$clientId`, and `$clientSecret`:

```shell
npm i -D @oktadev/schematics
schematics @oktadev/schematics:add-auth --issuer=$issuer --clientId=$clientId --clientSecret=$clientSecret
```

> **CAUTION:** An `.env` file will be generated with your client secret in it. Make sure to add `*.env` to `.gitignore` and don't check it into source control!

**Step 5**: Start your app and authenticate with Okta! 🚀

```shell
npm start
```

<a id="learn-more-about-node-js-and-javascript"></a>
## Learn More About Node.js and JavaScript

I hope you enjoyed this quick tour of how to add a login feature to a Node.js application. If you're looking to do more with Okta and Node.js, check out our [Node.js SDK](https://github.com/okta/okta-sdk-nodejs). It allows you to communicate with Okta APIs to manage your users and their identity.

You can find the source code for this example on GitHub [@oktadeveloper/okta-nodejs-login-example](https://github.com/oktadeveloper/okta-nodejs-login-example).

If you liked this screencast, you might enjoy our other tutorials too.

- [📺 Build a Secure Node.js App with SQL Server Step-by-Step](https://youtu.be/XJpYH7K7TGM)
- [📺 Build a Weight Tracker App with Node.js and PostgreSQL](https://youtu.be/LWPIdzeiThs)
- [How to Build a Secure AWS Lambda API with Node.js and React](/blog/2020/04/22/build-secure-aws-lambda-nodejs-react)
- [What's New for Node.js in 2020](/blog/2019/12/04/whats-new-nodejs-2020)
- [Build a Basic CRUD App with Vue.js and Node](/blog/2018/02/15/build-crud-app-vuejs-node)
- [Get Started with Koa.js for Node Applications](/blog/2019/11/08/get-started-with-koa-for-node-apps)

For more awesome tech talk, follow [@oktadev](https://twitter.com/oktadev) on Twitter. We have a [fun YouTube channel](https://youtube.com/oktadev) too! If you have any questions about Node.js, Okta, or anything related to this blog post, please ask in the comments below.
