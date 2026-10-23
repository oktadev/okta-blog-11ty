---
disqus_thread_id: 8299717293
discourse_topic_id: 17301
discourse_comment_url: https://devforum.okta.com/t/17301
title: "Use the Okta CLI to Quickly Build Secure Angular Apps"
author: matt-raible
by: advocate
communities: [javascript]
description: "This 2-minute video shows you how to use the Okta CLI to make secure Angular apps possible in minutes."
tags: [javascript, angular, typescript, authentication]
tweets:
- "Want to learn how to create a secure @angular in minutes? @mraible has a screencast for that!"
- "The Okta CLI makes it possible to create an account, download a sample, and configure it in seconds!"
- "We 💙 the Okta CLI here at @oktadev. This screencast shows how to use it with @angular."
image: okta-cli-angular/okta-cli-angular.png
type: conversion
changelog:
- 2020-02-02: Added note about `okta start angular` changing its default from using the Sign-In Widget to using the more secure redirect authentication. See [okta-blog#1066](https://github.com/oktadev/okta-blog/pull/1066) for changes to this post.
---
The Okta CLI is a new tool we've created here at Okta. It's designed to streamline creating new Okta accounts, registering apps, and getting started. Wwwhhaaattt, you might say?! That's right, it's super awesome!

To show you how easy it is, I [created a screencast that shows you how to use it with Angular](https://youtu.be/aMmTcLnoZzc).

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" style="max-width: 100%" src="https://www.youtube.com/embed/aMmTcLnoZzc" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

> **IMPORTANT:** To create the same app as the one shown in this video, you'll need to run `okta start angular --branch widget`.

For those that would rather read than watch—this is for you.

## Install the Okta CLI

You can find the website for the Okta CLI at [cli.okta.com](https://cli.okta.com/). This site has instructions on how to use common package managers on macOS, Windows, and Linux. You can also use cURL:

```shell
curl https://raw.githubusercontent.com/okta/okta-cli/master/cli/src/main/scripts/install.sh | bash
```

Once you have the Okta CLI installed, you'll need [Node.js installed](https://nodejs.org/) to build your Angular app. I used v14.15.0 in this screencast.

## Create an Angular App

To create a secure Angular app with Okta, run `okta start angular`. You'll need to verify your email and set a password as part of this.

> **TIP:** If you already have an Okta account, you can run `okta login` first.

This command will download our [Okta Angular sample](https://github.com/okta-samples/okta-angular-sample), register your app on Okta, and configure it by creating a `.okta.env` file with your issuer and client ID.

Follow the instructions that are printed out for you. To summarize:

```shell
cd angular
npm install
npm start
```

Next, open your browser to `http://localhost:4200` in an incognito window. You will see a screen like the following:

{% img {src: "okta-cli-angular/homepage.png", alt: "Angular sample homepage", header: "800"} %}

Click **Login** and authenticate with your credentials.

{% img {src: "okta-cli-angular/login.png", alt: "Angular Login", header: "800"} %}

Upon successful sign-in, you'll be returned to your app. Click on **Profile** to see your data that's retrieved from your ID token.

```typescript
export class ProfileComponent implements OnInit {
  claims!: { name: string; value: unknown }[];

  constructor(@Inject(OKTA_AUTH) public oktaAuth: OktaAuth) {
  }

  async ngOnInit() {
    const idToken = await this.oktaAuth.tokenManager.get('idToken');
    this.claims = Object.entries(idToken.claims).map(entry => ({ name: entry[0], value: entry[1] }));
  }

}
```

{% img {src: "okta-cli-angular/profile.png", alt: "Your ID Token Claims", header: "800"} %}

## Learn More about Angular and Okta

I hope you've enjoyed this brief intro to the Okta CLI. It's a tool that makes developers' lives easier. If you have any suggestions for improvement, please add an issue to our [okta/okta-cli](https://github.com/okta/okta-cli) repository.

If you like Angular and Okta, you might like these posts:

- [Build a Beautiful App + Login with Angular Material](/blog/2020/01/21/angular-material-login)
- [Build a CRUD App with Angular 9 and Spring Boot 2.2](/blog/2020/01/06/crud-angular-9-spring-boot-2)
- [How to Work with Angular and MySQL](/blog/2019/08/16/angular-mysql-express)
- 📺 [OktaDev Angular Playlist on YouTube](https://www.youtube.com/watch?v=BKepFaIwCvo&list=PLshTZo9V1-aE4lo3ByFQWex5b-QXeyX-P)

Please follow us **@oktadev** on [Twitter](https://twitter.com/oktadev), [YouTube](https://youtube.com/oktadev) and [Twitch](https://www.twitch.tv/oktadev) to stay up-to-date with our latest tools and techniques.
