---
title: "Three Ways to Run Your Java Locally with HTTPS"
author: brian-demers
by: advocate
communities: [java]
description: "This post describes three different options to get your local Java app running securely with TLS in no time, whether you need it publicly available or not."
tags: [java, security, https, localhost, spring, spring-boot]
tweets:
- "Your prod env uses HTTPS, how about dev? If your answer is no, keep reading 🔒"
- "Learn how to enable HTTPS for your local #Java development 🔒"
image: local-https-java/java-https-social.jpg
type: awareness
---
If you're developing a web application, chances are you want your dev environment as close to production as possible. One of the often-overlooked differences between local development and production servers is the use of Transport Layer Security (TLS), or Hypertext Transfer Protocol Secure (HTTPS). In this post, I'll cover three different options to get your local Java app running with TLS in no time!

[[toc]]

## Start with a simple Java application

To test out these options, you will, of course, need a Java web application. If you already have one handy, skip this step!

Bootstrap a new application using the [Spring Initializer](https://start.spring.io/#!type=maven-project&language=java&packaging=jar&jvmVersion=11&groupId=com.example&artifactId=demo&name=demo&description=Demo%20project%20for%20Spring%20Boot&packageName=com.example.demo&dependencies=web,devtools). Clicking on that link will automatically add the `web` and `devtools` dependencies.

1. Download the project using the **Generate** button.
2. Extract the zip file.
3. Open the project with your favorite IDE.

The last thing to do is to add a basic `RestController` in `src/main/java/com/example/demo/HelloController.java`:

```java
package com.example.demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/")
    public String sayHello() {
        return "Yes, this is another Hello World...";
    }
}
```

That's it! Start the application either from your IDE or by running `./mvnw spring-boot:run`.

Now access this boring, non-secure application in your browser at`http://localhost:8080/`.

## HTTPS using an internet proxy

One of the quickest ways to get a local application running with TLS is to use an internet proxy like ngrok. [Download and install ngrok](https://ngrok.com/download) and then start up the service using:

```bash
ngrok http 8080
```

This command will expose your local service running port `8080` over the internet on a _generated_ URL such as `https://abcd-11-22-33-44.ngrok.io`.

If you don't want to install ngrok, you could use [localhost.run](https://localhost.run/), which works using SSH port forwarding. Try it out with:

```bash
ssh -R 80:localhost:8080 nokey@localhost.run
```

Similar to ngrok, a temporary URL will be generated. For example, `https://152ccb7ac9369e.lhr.life`.

The goal of these tools is to provide a publicly available URL for your local development, which is perfect if you want to share something via the internet. If you don't want to share, it's best not to expose your development machine to any potential attackers online. The following two options avoid this issue.

## Create a certificate authority with mkcert

The next two options use a tool called [`mkcert`](https://github.com/FiloSottile/mkcert), which sets up a locally trusted certificate authority (CA), installed into the trust stores on your computer. Any certificates issued by this CA will be trusted by the client of your choice (Chrome, Firefox, curl, etc.).

On macOS, you can install `mkcert` with Homebrew; for other operating systems you can find instructions in the [`mkcert` docs](https://github.com/FiloSottile/mkcert#installation).

```bash
brew install mkcert nss
# nss is only needed if you are using Firefox
```

Create and install the certificate authority:

```bash
mkcert -install
```

```txt
Created a new local CA 💥
Sudo password:
The local CA is now installed in the system trust store! ⚡️
The local CA is now installed in Java's trust store! ☕️
```

> **IMPORTANT:**
>
> If you are on macOS and using [HTTPie](https://httpie.io/), you will need to add the CA to [HTTPie manually](https://github.com/httpie/httpie/issues/480):
>
> ```bash
> cat "$(mkcert --CAROOT)/rootCA.pem" >> \
> $(brew --prefix)/Cellar/httpie/*/libexec/lib/python*/site-packages/certifi/cacert.pem
> ```

That was _mostly_ painless, now let's secure the application you just created!

## Reverse proxy with Nginx

Many production applications terminate TLS using a reverse proxy like Nginx. This can also be an excellent option for local development and has the added advantage of working with any web application framework.

To run Nginx, I'll use the [official Nginx Docker image](https://hub.docker.com/_/nginx). To keep things organized, create a new directory to hold the configuration:

```bash
mkdir localhost-tls
cd localhost-tls
```

Next, use `mkcert` to generate the certificates Nginx will use.

```bash
mkdir devcerts
mkcert -key-file devcerts/key.pem -cert-file devcerts/cert.pem localhost
```

This command generates a private key and certificate in the new `devcerts` directory for the host, `localhost`.

Create an `nginx-default.conf.template` configuration file:

<div class="example">

```conf
server {
    listen 80;
    server_name _;
    rewrite ^/(.*)$ https://$host$request_uri? permanent; # <1>
}

server {
  server_name _;

  location / {
    proxy_pass http://host.docker.internal:${TARGET_PORT}; # <2>

    # <3>
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host:443;
    proxy_set_header X-Forwarded-Port 443;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Forwarded-Proto https;
  }

  listen 443 ssl;
  ssl_certificate /etc/nginx/certs/cert.pem;
  ssl_certificate_key /etc/nginx/certs/key.pem;
}
```

1. Redirect all http requests to https.
2. Windows and Mac hosts run Docker in a VM, the hostname `host.docker.internal` is used to point back to the "host" OS and the port.
3. Set the proxy headers, so the downstream app will know what URL the client is using.
{.colist}

</div>

### Tie it all together with Docker

Now that you have your Java application, the certificates, and the Nginx configuration ready to go, the only thing left is to start it up!

Use `docker run` to start Nginx with the above files as volumes that configure the service.

<div class="example">

```bash
docker run \
    -v $(pwd)/nginx-default.conf.template:/etc/nginx/templates/default.conf.template \ # <1>
    -v $(pwd)/devcerts:/etc/nginx/certs \ # <2>
    -p 443:443 \
    -p 80:80 \
    --env TARGET_PORT=8080 \ # <3>
    nginx
```

1. The Nginx configuration file template.
2. The path to the certificates.
3. The port where your application is running on `localhost`.
{.colist}

</div>

> **NOTE:** You can codify this solution using a [docker-compose.yml file](https://github.com/oktadev/mkcert-nginx-example/blob/main/docker-compose.yml) if you prefer!

Test it out! Open up your browser to `https://localhost/`.

## Configure Spring Boot to use HTTPS

The previous options used a separate service to handle TLS; this time, I'll configure Spring Boot's embedded Tomcat server to terminate TLS directly.

Generate another set of certificates with `mkcert`. This time set the output format to `pkcs12`, which is a format the Java KeyStore understands.

```bash
# create the directory
mkdir -p ~/.config/spring-boot

# generate a certificate in pkcs12 format
mkcert -pkcs12 -p12-file ~/.config/spring-boot/local-tls.p12 localhost
```

Create a properties file `~/.config/spring-boot/spring-boot-devtools.properties` containing the server port and newly generated keystore location.

```properties
# Set the port
server.port=8443

# configure the key store path
server.ssl.key-store=${user.home}/.config/spring-boot/local-tls.p12
```

Now restart your Spring Boot application, and open your browser to `https://localhost:8443` to access your newly secured application!

> **TIP:**
>
> I didn't need to make any changes to my application because it's using [Spring Boot DevTools](https://docs.spring.io/spring-boot/docs/current/reference/html/using.html), which automatically includes the above properties file. If you are **not** using DevTools, you can mimic this behavior by setting an environment variable before starting your application:
>
> ```bash
> SPRING_CONFIG_IMPORT='${user.home}/.config/spring-boot/spring-boot-devtools.properties'
> ```

## Bonus: Use a different hostname

The above examples use `localhost`, which works, but you might want to use a different hostname. One easy way to do this is to add a hostname alias to your `/etc/hosts` file:

```bash
sudo sh -c 'echo "127.0.0.1 local.example" >> /etc/hosts'
```

In the above examples, when generating certificates with `mkcert`, replace `localhost` with your domain name. Here's an example:

```bash
mkcert -key-file devcerts/key.pem -cert-file devcerts/cert.pem local.example
```

> **WARNING:** Use a domain name that you own or that is NOT in the official [top-level domain list](https://data.iana.org/TLD/tlds-alpha-by-domain.txt) to ensure there are no conflicting or hijacked DNS entries.

## Potential problems using HTTPS for local development

It's not all sunshine and roses. If you are a developer that works on multiple applications there are a few things to watch out for. Your browser may automatically switch to HTTPS if you are switching between applications that run on HTTP and HTTPS prototypes, especially if one of your applications sets the [HTTP Strict-Transport-Security (HTST) headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security). If you run into this type of problem you can clear the [SSL State](https://www.a2hosting.com/kb/getting-started-guide/internet-and-networking/clearing-a-web-browsers-ssl-state) and/or [HSTS settings](https://www.thesslstore.com/blog/clear-hsts-settings-chrome-firefox/) in your browser.

> **TIP:** Use a different hostname for each application you are working on to avoid browser caching.

## Learn more about building secure Java applications

This post has demonstrated three options for running applications locally using TLS/HTTPS. Each option has its own strengths and weaknesses.

- Using an Internet proxy exposes your application to the world; however, this could be what you want if you are testing [web hooks](/docs/concepts/inline-hooks/).
- Running a reverse proxy will work for any application, but it's one more service to manage (...and remember to start 😉 ).
- Running directly in the Spring Boot application, _just works_™️ once it's set up. However, it cannot use the default HTTPS port (`443`) without some other workaround, like ([iptables](https://mcaikovski.blogspot.com/2018/01/forwarding-ports-80-to-8080-or-443-to.html), [authbind](https://serverfault.com/questions/112795/how-to-run-a-server-on-port-80-as-a-normal-user-on-linux#answer-112805), [setcap](https://techblog.jeppson.org/2017/12/make-java-run-privileged-ports-centos-7/), etc.).

Now that your application is running securely with TLS, check out these posts to learn how to add secure user authentication!

- [Five Anti-Patterns with Secrets in Java](/blog/2021/12/14/antipatterns-secrets-java)
- [OAuth 2.0 Patterns with Spring Cloud Gateway](/blog/2020/08/14/spring-gateway-patterns)
- [Build Native Java Apps with Micronaut, Quarkus, and Spring Boot](/blog/2021/06/18/native-java-framework-comparison)

If you have questions, please leave a comment below. If you liked this tutorial, follow [@oktadev](https://twitter.com/oktadev) on Twitter, follow us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
