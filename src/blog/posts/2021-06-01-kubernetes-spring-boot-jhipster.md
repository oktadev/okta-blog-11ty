---
disqus_thread_id: 8566354469
discourse_topic_id: 17379
discourse_comment_url: https://devforum.okta.com/t/17379
title: "Kubernetes to the Cloud with Spring Boot and JHipster"
author: matt-raible
by: advocate
communities: [java,devops]
description: "Giddyup and deploy to the cloud (Minikube and Google Cloud) with Kubernetes, Spring Boot, and JHipster!"
tags: [kubernetes, spring-boot, google-cloud, gke, minikube, jhipster, k9s, java]
tweets:
- "Avoid YAML and use JHipster to deploy your @springboot apps with @kubernetesio."
- "Dislike YAML? Me too! This 20-page Kubernetes tutorial only has 60 lines of YAML and you only need to write 36 of them. 😏"
- "JHipster makes it easy to create reactive @java microservices and deploy them with @kubernetesio. Learn more in this tutorial! 👇"
image: reactive-java-kubernetes/reactive-java-k8s.png
type: conversion
github: https://github.com/oktadev/java-microservices-examples/tree/main/jhipster-k8s
changelog:
- 2022-08-12: Added link to [CI/CD Java Microservices with CircleCI and Spinnaker](/blog/2022/08/12/ci-cd-circleci-spinnaker-microservices) as a downstream blog post. Changes can be viewed in [okta-blog#1241](https://github.com/oktadev/okta-blog/pull/1241).
- 2021-08-11: Fixed missing namespace parameters and Ingress definition. See the code changes in the [example on GitHub](https://github.com/oktadev/java-microservices-examples/pull/24). Changes to this post can be viewed in [okta-blog#857](https://github.com/oktadev/okta-blog/pull/857).
---
When your business or application is successful, it needs to scale. Not just technology-wise, but human-wise. When you're growing rapidly, it can be difficult to hire developers fast enough. Using a microservices architecture for your apps can allow you to divide up ownership and responsibilities, and scale teams along with your code.

Kubernetes is an open-source platform for managing containerized workloads and services. Kubernetes traces its lineage [directly from Borg](https://kubernetes.io/blog/2015/04/borg-predecessor-to-kubernetes/), Google's long-rumored internal container-oriented cluster-management system.

{% include "integrator-org-warning.njk" %}

Spring Boot and Spring Cloud were some of the pioneering frameworks in Javaland. However, even they stood on the shoulders of giants when they leveraged Netflix's open-source projects to embrace and extend. In 2018, [Netflix OSS announced they'd come full circle](https://netflixtechblog.com/netflix-oss-and-spring-boot-coming-full-circle-4855947713a0), and adopted Spring Boot.

Today, I'd like to show you how to build and deploy (with Kubernetes) a _reactive_ microservice architecture with Spring Boot, Spring Cloud, and JHipster. Why reactive? Because Spring Cloud Gateway is now the default for JHipster 7 gateways, even if you choose to build your microservices with Spring MVC.

{% img {src: "reactive-java-kubernetes/reactive-java-k8s.png", alt: "Reactive Java Kubernetes", header: "800"} %}

Spring Cloud Gateway is a library for building an API Gateway on top of Spring WebFlux. It easily integrates with OAuth to communicate between microservices. You just need to add a `TokenRelay` filter.

```yaml
spring:
  cloud:
    gateway:
      default-filters:
        - TokenRelay
```

> **CAUTION:** Spring Cloud no longer supports Netflix Zuul. An [open issue](https://github.com/spring-cloud/spring-cloud-gateway/issues/36) adds Spring MVC/Servlet support to Spring Cloud Gateway. It's scheduled for implementation before the end of 2021.

**Prerequisites**

- [Java 11](https://sdkman.io/)+
- [Node.js](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/)
- A [Google Cloud](https://cloud.google.com/) Account

[[toc]]

You can also [watch this tutorial as a screencast](https://youtu.be/SQFl7ggNYIE).

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" style="max-width: 100%" src="https://www.youtube.com/embed/SQFl7ggNYIE" title="Kubernetes to the Cloud with Spring Boot and JHipster" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

## A Brief Intro to Kubernetes (K8s)

Kubernetes is an open-source project from Google that provides an API for deploying your apps and making them talk with each other. It helps automate deployments and updates, and manages your apps and services with limited downtime. You use Docker containers and YAML to make it all work.

The YAML can be burdensome, but that's where JHipster comes in. It can generate the YAML for you!

## Create a Kubernetes-Ready Microservices Architecture

I showed you how to build [Reactive Java microservices with Spring Boot and JHipster](/blog/2021/01/20/reactive-java-microservices) in a previous post. Today, I'll show you how to generate K8s deployment descriptors, use Spring Cloud Config with Git, encrypt your secrets, and make it all work on Google Cloud ([GKE](https://cloud.google.com/kubernetes-engine/) to be specific).

Start by cloning the JHipster 7 { Vue, Spring Boot, WebFlux } reactive microservices project from GitHub:

```shell
git clone https://github.com/oktadeveloper/java-microservices-examples.git
cd java-microservices-examples/reactive-jhipster
```

> **TIP:**
>
> If you just want to see the completed project, just cd into the project's `jhipster-k8s` directory.
>
> ```shell
> cd ../jhipster-k8s
> ```

This project has four directories:

1. `gateway`: a Spring Boot + Spring Cloud Gateway project configured for OpenID Connect (OIDC) login. It's also configured as an OAuth 2.0 resource server. It contains a front-end application built with Vue.
2. `blog`: a Spring Boot + WebFlux microservice that talks to a Neo4j database.
3. `store`: a Spring Boot + WebFlux microservice that uses MongoDB.
4. `docker-compose`: a set of Docker files that describe how to run all containers together.

> **NOTE:** The SPA app on the gateway is currently a monolith. The JHipster team is still working on [micro frontends support](https://github.com/jhipster/generator-jhipster/issues/10189).

If you don't have JHipster installed, install it.

```shell
npm i -g generator-jhipster@7
```

## Generate Kubernetes Deployment Descriptors

Navigate to the `reactive-jhipster` directory. Next, create a `k8s` directory, cd into it, and run JHipster's [Kubernetes sub-generator](https://www.jhipster.tech/kubernetes/).

```shell
mkdir k8s
cd k8s
jhipster k8s
```

You'll be prompted with several questions. Answer them as I did below:

- Type of application: **Microservice application**
- Root directory: **../**
- Which applications? &lt;select all>
- Set up monitoring? **No**
- Which applications with clustered databases? select **store**
- Admin password for JHipster Registry: &lt;generate one>
- Kubernetes namespace: **demo**
- Docker repository name: &lt;your docker hub username>
- Command to push Docker image: `docker push`
- Enable Istio? **No**
- Kubernetes service type? **LoadBalancer**
- Use dynamic storage provisioning? **Yes**
- Use a specific storage class? &lt;leave empty>

> **NOTE:** If you don't want to publish your images on [Docker Hub](https://hub.docker.com/), leave the Docker repository name blank.

{% img {src: "reactive-java-kubernetes/jhipster-k8s.png", alt: "JHipster K8s command with answers", header: "800"} %}

After I answered these questions, my `k8s/.yo-rc.json` file had the following contents:

```json
{
  "generator-jhipster": {
    "appsFolders": ["blog", "gateway", "store"],
    "directoryPath": "../",
    "clusteredDbApps": ["store"],
    "serviceDiscoveryType": "eureka",
    "jwtSecretKey": "NDFhMGY4NjF...",
    "dockerRepositoryName": "mraible",
    "dockerPushCommand": "docker push",
    "kubernetesNamespace": "demo",
    "kubernetesServiceType": "LoadBalancer",
    "kubernetesUseDynamicStorage": true,
    "kubernetesStorageClassName": "",
    "ingressDomain": "",
    "monitoring": "no",
    "istio": false
  }
}
```

I already showed you how to get everything working with Docker Compose [in the previous tutorial](/blog/2021/01/20/reactive-java-microservices#run-your-microservices-stack-with-docker-compose). So today, I'd like to show you how to run things locally with [Minikube](https://minikube.sigs.k8s.io/docs/).

## Install Minikube to Run Kubernetes Locally

If you have Docker installed, you can run Kubernetes locally with Minikube. Run `minikube start` to begin.

```shell
minikube --cpus 8 start
```

> **CAUTION:** If this doesn't work, use `brew install minikube`, or see [Minikube's installation instructions](https://minikube.sigs.k8s.io/docs/start/).

This command will start Minikube with 16 GB of RAM and 8 CPUs. Unfortunately, the default, which is 16 GB RAM and two CPUs, did not work for me.

_You can skip ahead to creating your Docker images while you wait for this to complete._

After this command executes, it'll print out a message and notify you which cluster and namespace are being used.

```shell
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
```

> **TIP:** You can stop Minikube with `minikube stop` and start over with `minikube delete`.

## Create Docker Images with Jib

Now, you need to build Docker images for each app. In the {`gateway`, `blog`, `store` } directories, run the following Gradle command (where `<image-name>` is `gateway`, `store`, or `blog`).

This command should also be in the window where you ran `jhipster k8s`, so you can copy them from there.

```shell
./gradlew bootJar -Pprod jib -Djib.to.image=<docker-repo-name>/<image-name>
```

> **Create Private Docker Images**
>
> You can also build your images locally and publish them to your Docker daemon. This is the default if you didn't specify a base Docker repository name.
>
> ```shell
> # this command exposes Docker images to minikube
> eval $(minikube docker-env)
> ./gradlew -Pprod bootJar jibDockerBuild
> ```
>
> Because this publishes your images locally to Docker, you'll need to make modifications to your Kubernetes deployment files to use `imagePullPolicy: IfNotPresent`.
>
> ```yaml
> - name: gateway-app
>   image: gateway
>   imagePullPolicy: IfNotPresent
> ```
>
> Make sure to add this `imagePullPolicy` to the following files:
>
> - `k8s/gateway-k8s/gateway-deployment.yml`
> - `k8s/blog-k8s/blog-deployment.yml`
> - `k8s/store-k8s/store-deployment.yml`

## Register an OIDC App for Auth

You've now built Docker images for your microservices, but you haven't seen them running. First, you'll need to configure Okta for authentication and authorization.

{{ macro.cli({type: "jhipster"}) }}

JHipster ships with [JHipster Registry](https://www.jhipster.tech/jhipster-registry/). It acts as a Eureka service for service discovery and contains a Spring Cloud Config server for distributing your configuration settings.

Update `k8s/registry-k8s/application-configmap.yml` to contain your OIDC settings from the `.okta.env` file the Okta CLI just created. The Spring Cloud Config server reads from this file and shares the values with the gateway and microservices.

```yaml
data:
  application.yml: |-
    ...
    spring:
      security:
        oauth2:
          client:
            provider:
              oidc:
                issuer-uri: https://<your-okta-domain>/oauth2/default
            registration:
              oidc:
                client-id: <client-id>
                client-secret: <client-secret>
```

To configure the JHipster Registry to use OIDC for authentication, modify `k8s/registry-k8s/jhipster-registry.yml` to enable the `oauth2` profile.

```yaml
- name: SPRING_PROFILES_ACTIVE
  value: prod,k8s,oauth2
```

Now that you've configured everything, it's time to see it in action.

## Start Your Spring Boot Microservices with K8s

In the `k8s` directory, start your engines!

```shell
./kubectl-apply.sh -f
```

You can see if everything starts up using the following command.

```shell
kubectl get pods -n demo
```

You can use the name of a pod with `kubectl logs` to tail its logs.

```shell
kubectl logs <pod-name> --tail=-1 -n demo
```

You can use port-forwarding to see the JHipster Registry.

```shell
kubectl port-forward svc/jhipster-registry -n demo 8761
```

Open a browser and navigate to `http://localhost:8761`. You'll need to sign in with your Okta credentials.

Once all is green, use port-forwarding to see the gateway app.

```shell
kubectl port-forward svc/gateway -n demo 8080
```

Then, go to `http://localhost:8080`, and you should be able to add blogs, posts, tags, and products.

You can also automate testing to ensure that everything works. Set your Okta credentials as environment variables and run end-to-end tests using Cypress (from the gateway directory).

```shell
export CYPRESS_E2E_USERNAME=<your-username>
export CYPRESS_E2E_PASSWORD=<your-password>
npm run e2e
```

Proof it worked for me:

{% img {src: "reactive-java-kubernetes/cypress-e2e.png", alt: "Cypress end-to-end tests", header: "800"} %}

### Plain Text Secrets? Uggh!

You may notice that I used a secret in plain text in the `application-configmap.yml` file. Secrets in plain text are a bad practice! I hope you didn't check everything into source control yet!!

## Encrypt Your Secrets with Spring Cloud Config

The JHipster Registry has an encryption mechanism you can use to encrypt your secrets. That way, it's safe to store them in public repositories.

Add an `ENCRYPT_KEY` to the environment variables in `k8s/registry-k8s/jhipster-registry.yml`.

```yaml
- name: ENCRYPT_KEY
  value: really-long-string-of-random-charters-that-you-can-keep-safe
```

> **TIP:**
>
> You can use JShell to generate a UUID you can use for your encrypt key.
>
> ```shell
> jshell
>
> UUID.randomUUID()
> ```
>
> {% img {src: "reactive-java-kubernetes/jshell-uuid.png", alt: "JShell UUID", header: "780"} %}
>
> You can quit by typing `/exit`.

Restart your JHipster Registry containers from the `k8s` directory.

```shell
./kubectl-apply.sh -f
```

### Encrypt Your OIDC Client Secret

You can encrypt your client secret by logging into `http://localhost:8761` and going to **Configuration** > **Encryption**. If this address doesn't resolve, you'll need to port-forward again.

```shell
kubectl port-forward svc/jhipster-registry -n demo 8761
```

Copy and paste your client secret from `application-configmap.yml` (or `.okta.env`) and click **Encrypt**.

{% img {src: "reactive-java-kubernetes/registry-encrypt.png", alt: "JHipster Registry Encrypt Feature", header: "800"} %}

Then, copy the encrypted value back into `application-configmap.yml`. Make sure to wrap it in quotes!

You can also use curl:

```shell
curl -X POST http://admin:<password-you-set-earlier>@localhost:8761/config/encrypt -d your-client-secret
```

If you use curl, make sure to add `{cipher}` to the beginning of the string. For example:

```yaml
client-secret: "{cipher}1b12934716c32d360c85f651a0793df2777090c..."
```

Apply these changes and restart all deployments.

```shell
./kubectl-apply.sh -f
kubectl rollout restart deploy -n demo
```

Verify everything still works at `http://localhost:8080`.

> **TIP:** If you don't want to restart the Spring Cloud Config server when you update its configuration, see [Refresh the Configuration in Your Spring Cloud Config Server](/blog/2020/12/07/spring-cloud-config#refresh-the-configuration-in-your-spring-cloud-config-server).

### Change Spring Cloud Config to use Git

You might want to store your app's configuration externally. That way, you don't have to redeploy everything to change values. Good news! Spring Cloud Config makes it easy to switch to Git instead of the filesystem to store your configuration.

In `k8s/registry-k8s/jhipster-registry.yml`, find the following variables:

```yaml
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_0_TYPE
  value: native
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_0_SEARCH_LOCATIONS
  value: file:./central-config
```

Below these values, add a second lookup location.

```yaml
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_1_TYPE
  value: git
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_1_URI
  value: https://github.com/mraible/reactive-java-ms-config/
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_1_SEARCH_PATHS
  value: config
- name: SPRING_CLOUD_CONFIG_SERVER_COMPOSITE_1_LABEL
  value: main
```

Create a GitHub repo that matches the URI, path, and branch you entered.

In my case, I created [reactive-java-ms-config](https://github.com/mraible/reactive-java-ms-config/) and added a `config/application.yml` file in the `main` branch. Then, I added my `spring.security.*` values to it and removed them from `k8s/registry-k8s/application-configmap.yml`.

See Spring Cloud Config's [Git Backend docs](https://cloud.spring.io/spring-cloud-config/multi/multi__spring_cloud_config_server.html#_git_backend) for more information.

## Deploy Spring Boot Microservices to Google Cloud (aka GCP)

It's nice to see things running locally on your machine, but it's even better to get to production! In this section, I'll show you how to deploy your containers to Google Cloud.

First, stop Minikube if you were running it previously.

```shell
minikube stop
```

You can also use `kubectl` commands to switch clusters.

```shell
kubectl config get-contexts
kubectl config use-context XXX
```

The cool kids use `kubectx` and `kubens` to set the default context and namespace. You can learn how to install and use them via the [kubectx GitHub project](https://github.com/ahmetb/kubectx).

### Create a Container Registry on Google Cloud

Before the JHipster 7.0.0 release, I tested this microservice example with Kubernetes and Google Cloud. I found many solutions in Ray Tsang's [Spring Boot on GCP Guides](https://spring-gcp.saturnism.me/). [Thanks, Ray](https://twitter.com/mraible/status/1372964263237718026)!

To start with Google Cloud, you'll need an account and a project. [Sign up for Google Cloud Platform (GCP)](https://spring-gcp.saturnism.me/getting-started/google-cloud-platform), log in, and create a project. Open a [console](https://console.cloud.google.com/) in your browser. A GCP project contains all cloud services and resources--such as virtual machines, network, load balancers--that you might use.

> **TIP:** You can also download and install the [`gcloud` CLI](https://cloud.google.com/sdk/) if you want to run things locally.

Enable the Google Kubernetes Engine API and Container Registry:

```shell
gcloud services enable container.googleapis.com containerregistry.googleapis.com
```

### Create a Kubernetes Cluster

Run the following command to create a cluster for your apps.

```shell
gcloud container clusters create CLUSTER_NAME \
--zone us-central1-a \
--machine-type n1-standard-4 \
--enable-autorepair \
--enable-autoupgrade
```

I called my cluster `reactive-ms`. See GCP's [zones](https://cloud.google.com/compute/docs/regions-zones/) and [machine-types](https://cloud.google.com/compute/docs/machine-types/) for other options. I found the `n1-standard-4` to be the minimum for JHipster.

You created Docker images earlier to run with Minikube. Then, those images were deployed to Docker Hub or your local Docker registry. If you deployed to Docker Hub, you can use your deployment files as-is.

For Google Cloud and its Kubernetes engine (GKE), you can also publish your images to your project's registry. Thankfully, this is easy to do with Jib.

Navigate to the `gateway` directory and run:

```shell
./gradlew bootJar -Pprod jib -Djib.to.image=gcr.io/<your-project-id>/gateway
```

You can get your project ID by running `gcloud projects list`.

Repeat the process for `blog` and `store`. You can run these processes in parallel to speed things up.

```shell
cd ../blog
./gradlew bootJar -Pprod jib -Djib.to.image=gcr.io/<your-project-id>/blog
cd ../store
./gradlew bootJar -Pprod jib -Djib.to.image=gcr.io/<your-project-id>/store
```

> **TIP:** You might have to run `gcloud auth configure-docker` for Jib to publish to your GCP container registry.

Then, in your `k8s/**/*-deployment.yml` files, add `gcr.io/<your-project-id>` as a prefix. Remove the `imagePullPolicy` if you specified it earlier. For example:

```yaml
containers:
  - name: gateway-app
    image: gcr.io/jhipster7/gateway
    env:
```

In the `k8s` directory, apply all the deployment descriptors to run all your images.

```shell
./kubectl-apply.sh -f
```

You can monitor the progress of your deployments with `kubectl get pods -n demo`.

> **TIP:**
>
> If you make a mistake configuring JHipster Registry and need to deploy it, you can do so with the following command:
>
> ```shell
> kubectl apply -f registry-k8s/jhipster-registry.yml -n demo
> kubectl rollout restart statefulset/jhipster-registry -n demo
> ```
>
> You'll need to restart all your deployments if you changed any configuration settings that services need to retrieve.
>
> ```shell
> kubectl rollout restart deploy -n demo
> ```

### Access Your Gateway on Google Cloud

Once everything is up and running, get the external IP of your gateway.

```shell
kubectl get svc gateway -n demo
```

You'll need to add the external IP address as a valid redirect to your Okta OIDC app. Run `okta login`, open the returned URL in your browser, and sign in to the Okta Admin Console. Go to the **Applications** section, find your application, and edit it.

Add the standard JHipster redirect URIs using the IP address. For example, `http://34.71.48.244:8080/login/oauth2/code/oidc` for the login redirect URI, and `http://34.71.48.244:8080` for the logout redirect URI.

You can use the following command to set your gateway's IP address as a variable you can curl.

```shell
EXTERNAL_IP=$(kubectl get svc gateway -ojsonpath="{.status.loadBalancer.ingress[0].ip}" -n demo)
curl $EXTERNAL_IP:8080
```

Run `open http://$EXTERNAL_IP:8080`, and you should be able to sign in.

{% img {src: "reactive-java-kubernetes/gke-first-login.png", alt: "First log in on GKE", header: "800"} %}

Great! Now that you know things work, let's integrate better security, starting with HTTPS.

### Add HTTPS to Your Reactive Gateway

You should always use HTTPS. It's one of the easiest ways to secure things, especially with the free certificates offered these days. Ray Tsang's [External Load Balancing docs](https://spring-gcp.saturnism.me/deployment/kubernetes/load-balancing/external-load-balancing) was a big help in figuring out all these steps.

You'll need a static IP to assign your TLS (the official name for HTTPS) certificate.

```shell
gcloud compute addresses create gateway-ingress-ip --global
```

You can run the following command to make sure it worked.

```shell
gcloud compute addresses describe gateway-ingress-ip --global --format='value(address)'
```

Then, create a `k8s/ingress.yml` file:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "gateway-ingress-ip"
spec:
  rules:
  - http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: gateway
            port:
              number: 8080
```

Deploy it and make sure it worked.

```shell
kubectl apply -f ingress.yml -n demo

# keep running this command displays an IP address
# (hint: up arrow recalls the last command)
kubectl get ingress gateway -n demo
```

To use a TLS certificate, you must have a fully qualified domain name and configure it to point to the IP address. If you don't have a real domain, you can use [nip.io](https://nip.io/).

Set the IP in a variable, as well as the domain.

```shell
EXTERNAL_IP=$(kubectl get ingress gateway -ojsonpath="{.status.loadBalancer.ingress[0].ip}" -n demo)
DOMAIN="${EXTERNAL_IP}.nip.io"

# Prove it works
echo $DOMAIN
curl $DOMAIN
```

To create a certificate, create a `k8s/certificate.yml` file.

```shell
cat << EOF > certificate.yml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: gateway-certificate
spec:
  domains:
  # Replace the value with your domain name
  - ${DOMAIN}
EOF
```

Add the certificate to `ingress.yml`:

```yaml
...
metadata:
  name: gateway
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "gateway-ingress-ip"
    networking.gke.io/managed-certificates: "gateway-certificate"
...
```

Deploy both files:

```shell
kubectl apply -f certificate.yml -f ingress.yml -n demo
```

Check your certificate's status until it prints `Status: ACTIVE`:

```shell
kubectl describe managedcertificate gateway-certificate -n demo
```

While you're waiting, you can proceed to forcing HTTPS in the next step.

### Force HTTPS with Spring Security

Spring Security's WebFlux support makes it easy to [redirect to HTTPS](https://docs.spring.io/spring-security/site/docs/5.5.x/reference/html5/#webflux-http-redirect). However, if you redirect _all_ HTTPS requests, the Kubernetes health checks will fail because they receive a 302 instead of a 200.

Crack open `SecurityConfiguration.java` in the gateway project and add the following code to the `springSecurityFilterChain()` method.

**src/main/java/.../gateway/config/SecurityConfiguration.java**

```java
http.redirectToHttps(redirect -> redirect
    .httpsRedirectWhen(e -> e.getRequest().getHeaders().containsKey("X-Forwarded-Proto"))
);
```

Rebuild the Docker image for the gateway project.

```shell
./gradlew bootJar -Pprod jib -Djib.to.image=gcr.io/<your-project-id>/gateway
```

Run the following commands to start a rolling restart of gateway instances:

```shell
kubectl rollout restart deployment gateway -n demo
```

> **TIP:** Run `kubectl get deployments` to see your deployment names.

Now you should get a 302 when you access your domain. [HTTPie](https://httpie.io/) is a useful alternative to curl.

{% img {src: "reactive-java-kubernetes/httpie-302.png", alt: "302 in HTTPie", header: "800"} %}

Update your Okta OIDC app to have `https://${DOMAIN}/login/oauth2/code/oidc` as a valid redirect URI. Add `https://${DOMAIN}` to the sign-out redirect URIs too.

## Encrypt Your Kubernetes Secrets

Congratulations! Now you have everything running on GKE, using HTTPS! However, you have a lot of plain-text secrets in your K8s YAML files.

"But, wait!" you might say. Doesn't [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/) solve everything?

In my opinion, no. They're just unencrypted base64-encoded strings stored in YAML files. There's a good chance you'll want to check in the `k8s` directory you created.

Having secrets in your source code is a bad idea! The good news is most people (where most people = my followers) manage secrets externally.

<div style="max-width: 500px; margin: 0 auto 1.25rem">
<blockquote class="twitter-tweet"><p lang="en" dir="ltr">What&#39;s your favorite way to protect secrets in your <a href="https://twitter.com/kubernetesio?ref_src=twsrc%5Etfw">@kubernetesio</a> YAML files?</p>&mdash; Matt Raible (@mraible) <a href="https://twitter.com/mraible/status/1387439868444397568?ref_src=twsrc%5Etfw">April 28, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>

> **NOTE:** Watch [Kubernetes Secrets in 5 Minutes](https://www.youtube.com/watch?v=cQAEK9PBY8U) if you want to learn more about Kubernetes Secrets.

### The Current State of Secret Management in Kubernetes

I recently noticed a tweet from [Daniel Jacob Bilar](https://twitter.com/daniel_bilar/status/1379845799086022661) that links to a talk from FOSDEM 2021 on the [current state of secret management within Kubernetes](https://fosdem.org/2021/schedule/event/kubernetes_secret_management/). It's an excellent overview of the various options.

### Store Secrets in Git with Sealed Secrets and Kubeseal

[Bitnami](https://bitnami.com/) has a [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) Apache-licensed open source project. Its README explains how it works.

> **Problem**: "I can manage all my K8s config in git, except Secrets." > > **Solution**: Encrypt your Secret into a SealedSecret, which is safe to store - even to a public repository. The SealedSecret can be decrypted only by the controller running in the target cluster, and nobody else (not even the original author) is able to obtain the original Secret from the SealedSecret.

[Store your Kubernetes Secrets in Git thanks to Kubeseal. Hello SealedSecret!](https://dev.to/stack-labs/store-your-kubernetes-secrets-in-git-thanks-to-kubeseal-hello-sealedsecret-2i6h) by [Aurélie Vache](https://twitter.com/aurelievache) provides an excellent overview of how to use it.

First, you'll need to install the Sealed Secrets CRD (Custom Resource Definition).

```shell
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.16.0/controller.yaml
```

Retrieve the certificate keypair that this controller generates.

```shell
kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml
```

Copy the raw value of `tls.crt` and decode it. You can use the command line, or learn more about [base64 encoding/decoding](https://developer.okta.com/docs/guides/implement-grant-type/clientcreds/main/#base64-encode-the-client-id-and-client-secret) in our documentation.

```shell
echo -n <paste-value-here> | base64 --decode
```

Put the raw value in a `tls.crt` file.

Next, install Kubeseal. On macOS, you can use Homebrew. For other platforms, see [the release notes](https://github.com/bitnami-labs/sealed-secrets/releases/tag/v0.16.0).

```shell
brew install kubeseal
```

The major item you need to encrypt in this example is the `ENCRYPT_KEY` you used to encrypt the OIDC client secret. Run the following command to do this, where the value comes from your `k8s/registry-k8s/jhipster-registry.yml` file.

```shell
kubectl create secret generic encrypt-key \
  --from-literal=ENCRYPT_KEY='your-value-here' \
  --dry-run=client -o yaml > secrets.yml
```

Next, use `kubeseal` to convert the secrets to encrypted secrets.

```shell
kubeseal --cert tls.crt --format=yaml -n demo < secrets.yml > sealed-secrets.yml
```

Remove the original secrets file and deploy your sealed secrets.

```shell
rm secrets.yml
kubectl apply -n demo -f sealed-secrets.yml && kubectl get -n demo sealedsecret encrypt-key
```

### Configure JHipster Registry to use the Sealed Secret

In `k8s/registry-k8s/jhipster-registry.yml`, change the `ENCRYPT_KEY` to use your new secret.

```yaml
...
- name: ENCRYPT_KEY
  valueFrom:
    secretKeyRef:
      name: encrypt-key
      key: ENCRYPT_KEY
```

> **TIP:** You should be able to encrypt other secrets, like your database passwords, using a similar technique.

Now, redeploy JHipster Registry and restart all your deployments.

```shell
./kubectl-apply.sh -f
kubectl rollout restart deployment -n demo
```

You can use port-forwarding to see the JHipster Registry locally.

```shell
kubectl port-forward svc/jhipster-registry -n demo 8761
```

{% img {src: "reactive-java-kubernetes/port-forwarded-registry.png", alt: "Port-forwarding the Registry to localhost", header: "800"} %}

### Google Cloud Secret Manager

Google Cloud has a [Secret Manager](https://spring-gcp.saturnism.me/app-dev/cloud-services/secret-management) you can use to store your secrets. There's even a [Spring Boot starter](https://cloud.spring.io/spring-cloud-static/spring-cloud-gcp/current/reference/html/#secret-manager) to make it convenient to retrieve these values in your app.

For example, you could store your database password in a properties file.

```properties
spring.datasource.password=${sm://my-db-password}
```

This is pretty slick, but I like to remain cloud-agnostic. Also, I like how the JHipster Registry allows me to store encrypted secrets in Git.

### Use Spring Vault for External Secrets

Using an external key management solution like [HashiCorp Vault](https://www.hashicorp.com/products/vault) is also recommended. The JHipster Registry will have [Vault support in its next release](https://github.com/jhipster/jhipster-registry/pull/498).

In the meantime, I recommend reading [Secure Secrets With Spring Cloud Config and Vault](/blog/2020/05/04/spring-vault).

## Scale Your Reactive Java Microservices

You can scale your instances using the `kubectl scale` command.

```shell
kubectl scale deployments/store --replicas=2 -n demo
```

Scaling will work just fine for the microservice apps because they're set up as OAuth 2.0 resource servers and are therefore stateless.

However, the gateway uses Spring Security's OIDC login feature and stores the access tokens in the session. So if you scale it, sessions won't be shared. Single sign-on should still work; you'll just have to do the OAuth dance to get tokens if you hit a different instance.

To synchronize sessions, you can use [Spring Session and Redis](/blog/2020/12/14/spring-session-redis) with JHipster.

> **CAUTION:**
>
> If you leave everything running on Google Cloud, you will be charged for usage. Therefore, I recommend removing your cluster or deleting your namespace (`kubectl delete ns demo`) to reduce your cost.
>
> ```
> gcloud container clusters delete <cluster-name> --zone=us-central1-a
> ```
>
> You can delete your Ingress IP address too:
>
> ```
> gcloud compute addresses delete gateway-ingress-ip --global
> ```

## Monitor Your Kubernetes Cluster with K9s

{% img {src: "reactive-java-kubernetes/k9s.png", alt: "K9s"} %}

Using `kubectl` to monitor your Kubernetes cluster can get tiresome. That's where [K9s](https://github.com/derailed/k9s) can be helpful. It provides a terminal UI to interact with your Kubernetes clusters. K9s was created by my good friend [Fernand Galiana](https://twitter.com/kitesurfer). He's also created a commercial version called [K9sAlpha](https://k9salpha.io/).

To install it on macOS, run `brew install k9s`. Then run `k9s -n demo` to start it. You can navigate to your pods, select them with <kbd>Return</kbd>, and navigate back up with <kbd>Esc</kbd>.

{% img {src: "reactive-java-kubernetes/k9s-in-action.gif", alt: "K9s in Action", header: "800"} %}

There's also [KDash](https://github.com/kdash-rs/kdash), from JHipster co-lead, [Deepu K Sasidharan](https://twitter.com/deepu105). It's a simple K8s terminal dashboard built with Rust. Deepu recently [released an MVP of the project](https://twitter.com/deepu105/status/1383017556546584578).

If for some reason you don't like CLI's, you can try [Kubernetic](https://www.kubernetic.com/).

## Continuous Integration and Delivery of JHipster Microservices

This tutorial doesn't mention continuous integration and delivery of your reactive microservice architecture. To learn how to automate testing and publishing, see [CI/CD Java Microservices with CircleCI and Spinnaker](/blog/2022/08/12/ci-cd-circleci-spinnaker-microservices).

## Spring on Google Cloud Platform

JHipster uses Docker containers to run all its databases in this example. However, there are a number of Google Cloud services you can use as alternatives. See the [Spring Cloud GCP project on GitHub](https://spring.io/projects/spring-cloud-gcp) for more information.

I didn't mention Testcontainers in this post. However, [JHipster does support using them](https://atomfrede.gitlab.io/2019/05/jhipster-with-testcontainers/). Testcontainers also has a [GCloud Module](https://www.testcontainers.org/modules/gcloud/).

## Why Not Istio?

I didn't use Istio in this example because I didn't want to complicate things. Learning Kubernetes is hard enough without learning another system on top of it. Istio acts as a network between your containers that can do networky things like authentication, authorization, monitoring, and retries. I like to think of it as AOP for containers.

If you'd like to see how to use JHipster with Istio, see [How to set up Java microservices with Istio service mesh on Kubernetes](https://dev.to/deepu105/how-to-set-up-java-microservices-with-istio-service-mesh-on-kubernetes-5bkn) by JHipster co-lead [Deepu K Sasidharan](https://twitter.com/deepu105).

Fernand Galiana recommends checking out BPF (Berkeley Packet Filter) and [Cilium](https://cilium.io/). Cilium is open source software for transparently providing and securing the network and API connectivity between application services deployed using Linux container management platforms such as Kubernetes.

## Learn More About Kubernetes, Spring Boot, and JHipster

This blog post showed you how to deploy your reactive Java microservices to production using Kubernetes. JHipster did much of the heavy lifting for you since it generated all the YAML-based deployment descriptors. Since no one really likes writing YAML, I'm calling that a win!

You learned how to use JHipster Registry to encrypt your secrets and configure Git as a configuration source for Spring Cloud Config. Bitnami's Sealed Secrets is a nice companion to encrypt the secrets in your Kubernetes deployment descriptors.

For more information about storing your secrets externally, these additional resources might help.

- [Kelsey Hightower's Vault on Cloud Run Tutorial](https://twitter.com/kelseyhightower/status/1393062669754667017)
- [James Strachan's Helm Post Renderer](https://twitter.com/jstrachan/status/1393213646340337670)

You can find the source code for this example on GitHub in our [Java microservices examples repository](https://github.com/oktadeveloper/java-microservices-examples).

```shell
git clone https://github.com/oktadeveloper/java-microservices-examples.git
cd java-microservices-examples/jhipster-k8s
```

See JHipster's documentation on [Kubernetes](https://www.jhipster.tech/kubernetes/) and [GCP](https://www.jhipster.tech/gcp/) if you'd like more concise instructions.

If you enjoyed this post, I think you'll like these others as well:

- [CI/CD Java Microservices with CircleCI and Spinnaker](/blog/2022/08/12/ci-cd-circleci-spinnaker-microservices)
- [Reactive Java Microservices with Spring Boot and JHipster](/blog/2021/01/20/reactive-java-microservices)
- [Build a Secure Micronaut and Angular App with JHipster](/blog/2020/08/17/micronaut-jhipster-heroku)
- [Fast Java Made Easy with Quarkus and JHipster](/blog/2021/03/08/jhipster-quarkus-oidc)
- [How to Docker with Spring Boot](/blog/2020/12/28/spring-boot-docker)
- [Security Patterns for Microservice Architectures](/blog/2020/03/23/microservice-security-patterns)

If you have any questions, please ask them in the comments below.

To be notified when we publish new blog posts, follow us on [Twitter](https://twitter.com/oktadev) or [LinkedIn](https://www.linkedin.com/company/oktadev). We frequently publish videos to our [YouTube channel](https://youtube.com/c/oktadev) too. [Subscribe today](https://youtube.com/c/oktadev?sub_confirmation=1)!

_A huge thanks goes to [Fernand Galiana](https://twitter.com/kitesurfer) for his review and detailed feedback._
