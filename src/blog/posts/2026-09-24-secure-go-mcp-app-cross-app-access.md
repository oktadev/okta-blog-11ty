---
title: "Implement Secure Cross App Access (XAA) in Go"
author: vanshika
by: advocate
communities: [go]
description: "Learn how to build a secure Go MCP app that uses Cross App Access (XAA) and token exchange for AI agents without OAuth consent screens."
tags: [go, mcp, cross-app-access, xaa, oauth, oidc]
tweets:
  - ""
  - ""
  - ""
image: secure-go-mcp-app-cross-app-access/social.jpg
github: https://github.com/oktadev/okta-go-mcp-xaa-lab
type: conversion
---

Picture this: a salesperson at your company asks the company's AI assistant to book a dinner with a customer and log it against the deal in the sales pipeline app. They're already signed in to the assistant through the company's single sign-on, but the pipeline app's [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server still needs proof that the assistant is acting on that salesperson's behalf, and the company's security team wants a say in what it can touch. That's where Cross App Access (XAA) comes in: the company's identity provider checks its policies and issues the assistant a signed identity assertion, which the assistant exchanges for a scoped access token the pipeline app accepts. No second sign-in and no consent screen.

In this post, we'll understand XAA, then run a sample Go web app called AI Notes Assistant that uses XAA to fetch a user's to-do items from a protected MCP server and turn them into notes, no OAuth consent screen required. We'll test the flow with the [XAA playground](https://xaa.dev) and then walk through the Go code that makes it work.

To follow along, you'll need:

- [Git](https://git-scm.com/downloads) to clone the sample app
- [Go](https://go.dev/dl/) 1.26 or newer
- A code editor or IDE, such as VS Code or GoLand, to open the project and edit `config.json`
- A terminal (the one built into your IDE works)
- An email address to use on [xaa.dev](https://xaa.dev), where you'll register AI Notes Assistant as a requester app (xaa.dev doesn't create an account or ask for a password; it uses the email only to show you the apps you've registered)

[[toc]]

## What is Cross App Access (XAA)?

Before we start building, it's important to understand Cross App Access (XAA). XAA is a standard that helps apps and AI agents securely access other apps on a signed-in user's behalf. Instead of relying on shared user credentials or static API keys, it lets an organization's identity provider (IdP), such as Okta, help manage that access.

For example, an employee might ask an AI assistant to summarize a project document. XAA helps the assistant request access to the project app, while the identity provider's policies and the app's permissions determine what it can see.

You can think of XAA like an agreed process for using a partner company's building. Your employee badge won't open the partner's doors by itself; the partner needs a trusted way to verify who you are and grant the right level of access. XAA provides a similar way for apps to verify an agent's access on a user's behalf.

While the flow is sophisticated, it relies on two standard interactions, each defined in a Request for Comments (RFC) document published by the Internet Engineering Task Force (IETF):

1. [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) (Token Exchange): the requesting app hands its [OpenID Connect](https://openid.net/connect/) (OIDC) ID token to the enterprise IdP and asks for an [Identity Assertion Authorization Grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/) (ID-JAG)
2. [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) (JSON Web Token (JWT) Bearer Grant): the app hands that ID-JAG to the resource's own authorization server and gets back a scoped access token, ready to use against the real API

Before those two exchanges, the user signs in with OIDC using [Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636) (PKCE), which is Step 1 in the diagram below.

{% img {src: "secure-go-mcp-app-cross-app-access/xaa-sequence-diagram.svg", alt: "Sequence diagram in four steps. In step 1 the user signs in through AI Notes Assistant and the enterprise IdP using OIDC and PKCE, and the IdP returns an ID token. In step 2 the app exchanges the ID token for an ID-JAG at the IdP using RFC 8693. In step 3 the app sends the ID-JAG to the resource authorization server using the RFC 7523 JWT bearer grant and receives a scoped access token. In step 4 the app calls the MCP server with the access token and gets resource data back", header: "800"} %}

{#
Tweak the diagram on https://mermaid.live/ with the following content
%%{init: {'look': 'classic', 'themeVariables': {'fontSize': '18px', 'fontFamily': 'Helvetica, Arial, sans-serif'}, 'themeCSS': 'text, tspan, .messageText, .noteText, .actor { font-family: Helvetica, Arial, sans-serif !important; }', 'sequence': {'actorMargin': 60, 'width': 190, 'boxMargin': 10, 'noteMargin': 12, 'messageMargin': 40}}}%%
sequenceDiagram
    participant U as User
    participant IDP as Enterprise IdP
    participant C as AI Notes<br/>Assistant
    participant RAS as Resource<br/>Authorization<br/>Server
    participant RS as MCP Server

    Note over U,C: Step 1: Sign in (OIDC + PKCE)
    U->>C: Click Sign in
    C->>IDP: Authorize request (PKCE challenge)
    U->>IDP: Authenticate
    IDP-->>C: Authorization code
    C->>IDP: Code + PKCE verifier
    IDP-->>C: ID token

    Note over IDP,C: Step 2: Token Exchange (RFC 8693)
    C->>IDP: ID token
    IDP-->>C: ID-JAG

    rect rgb(255,244,214)
    Note over IDP,RAS: Step 3: JWT Bearer Grant (RFC 7523)
    C->>RAS: ID-JAG
    RAS-->>C: Scoped access token
    end

    Note over C,RS: Step 4: MCP request
    C->>RS: Request + Bearer access token
    RS-->>C: Resource data
#}

Look at the above flow diagram for a second before moving on: you can see zero manual consent prompts anywhere. The rest of this post runs a sample app that makes this flow real, then walks through the Go code behind each step. This post builds the client side in Go. If you want the policy side of the story, check out:

{% excerpt "enterprise-ai" %}

## Get the sample app

Let's watch the flow run before reading any code, so you have real tokens to follow when we walk through the implementation. The finished sample app lives in the [okta-go-mcp-xaa-lab repository](https://github.com/oktadev/okta-go-mcp-xaa-lab), so you don't write it from scratch. Open a terminal, clone the repository, and pull down its dependencies:

```shell
git clone https://github.com/oktadev/okta-go-mcp-xaa-lab
cd okta-go-mcp-xaa-lab
go mod tidy
```

Then open the `okta-go-mcp-xaa-lab` folder in your IDE (in VS Code, run `code .` from the same terminal, or use **File > Open Folder**). Keep it open: you'll edit `config.json` in the next section and read the Go files in the walkthrough afterward. Run every command in this post from the project's root folder, the one containing `main.go` and `config.json`.

## Register your app with xaa.dev

Next, register AI Notes Assistant as a requester app on xaa.dev:

1. Open the [xaa.dev registration page](https://xaa.dev/?have=requesting&want=register&via=oidc), enter your email address, and click **Continue**. Then, under **Register an OIDC requesting app**, click **+ Register New App**.
2. Set the redirect URI to `http://localhost:8080/callback` and the post-logout redirect URI to `http://localhost:8080/logged-out`
3. Under **Add Resource**, pick **ToDo MCP Server** and add the connection
4. Keep the xaa.dev page open. You'll copy the client ID and secrets it generates into `config.json` in the next section.


{% img {src: "secure-go-mcp-app-cross-app-access/xaa-dev-register-app.jpg", alt: "xaa.dev Edit App screen showing the requesting app's name, redirect URIs, and post-logout redirect URI configured for AI Notes Assistant", header: "800"} %}

## Running your Go MCP app locally

In your IDE, open `config.json` in the project root. It ships with placeholder values like `<your-client-id>`; replace them with the values from your xaa.dev registration. `clientId` and `clientSecret` come from the app you just registered; `mcpClientId` and `mcpClientSecret` are a separate pair xaa.dev issues for the MCP resource connection, the same two client IDs the code uses in the token exchanges you'll see shortly. `sessionSecret` isn't issued by xaa.dev at all, it's any long random string you generate yourself:

{% img {src: "secure-go-mcp-app-cross-app-access/xaaflow.jpg", alt: "xaa.dev app registration card and a sample token request annotated with clientId, clientSecret, mcpClientId, and mcpClientSecret, showing where each config.json value comes from", header: "800"} %}

```json
{
  "xaa": {
    "clientId":        "<your-client-id>",
    "clientSecret":    "<your-client-secret>",
    "idpBaseUrl":      "https://idp.xaa.dev",

    "mcpClientId":     "<your-mcp-client-id>",
    "mcpClientSecret": "<your-mcp-client-secret>",

    "authServerUrl":   "https://auth.resource.xaa.dev",
    "mcpServerUrl":    "https://mcp.xaa.dev/mcp",
    "resourceUri":     "todo0://todos",
    "scope":           "todos.read mcp.access",

    "redirectUri":     "http://localhost:8080/callback",
    "sessionSecret":   "<any-long-random-string>"
  },
  "saml": { "enabled": false },
  "port": 8080
}
```

The file in the repo has a few extra placeholder values under `saml`. Leave them alone: `"enabled": false` keeps Security Assertion Markup Language (SAML) sign-in switched off, and this post only uses OIDC.

Save the file. Then, in your terminal, from the project root, start the server:

```shell
go run .
```

The terminal prints a line ending in `AI Notes Assistant listening on http://localhost:8080` and stays running; leave it open. In your browser, go to `http://localhost:8080`. You'll see the AI Notes Assistant home screen with a **Sign in** button.

Click **Sign in**. The xaa.dev playground handles the login itself, so you can confirm this by checking the URL in your browser: it redirects to `idp.xaa.dev` before bouncing you back to `localhost:8080/callback`. Sign in with a test email, then enter the verification code the playground asks for. xaa.dev runs in demo mode, so any 6-digit code works.

Once you're signed in, click **Analyze My Notes**. Watch the page stream every step live: the login, the token exchange, the bearer token landing, and the MCP resource fetch, alongside the decoded token claims and the notes pulled straight from the resource server. That's the real token exchange running against your local Go MCP app, not a simulation. Keep this dashboard open: the next section walks through the code behind each step, and the values you see here are the ones that code produces.

Here's the whole run, end to end, in case yours looks different: signing in at the identity provider, verifying with a demo verification code, landing on the AI Notes Assistant home screen, and the finished dashboard with all four steps checked off, the access token, its claims, and the notes pulled from the resource server.

{% img {src: "secure-go-mcp-app-cross-app-access/running-go-mcp-app-with-xaa-dev.jpg", alt: "Four panel walkthrough of running the Go MCP app with xaa.dev, showing signing in at the identity provider, verifying identity with a demo six digit code, the AI Notes Assistant home screen, and the dashboard with the completed XAA flow steps, access token, token claims, and notes", header: "800"} %}

## Building the XAA flow in Go

Now that you've seen the flow run, let's look at the code behind it. AI Notes Assistant runs through that exact chain in four steps, and each step below maps to an entry on the dashboard you just saw. You don't need to type anything here: every snippet is excerpted from a file in the project you cloned, and its first comment gives the path. Open that file in your IDE to see the full version and follow along with the app still running.

### Signing the user in with OIDC and PKCE

This is Step 1. A user clicks sign in, and the app redirects them to the IdP using OIDC. `HandleLogin` does one thing most frameworks handle for you automatically: it builds its own PKCE challenge. PKCE stops an attacker who intercepts the authorization code from redeeming it, because only this app holds the matching verifier.

```go
// internal/oidcauth/oidc.go
func (a *Auth) HandleLogin(w http.ResponseWriter, r *http.Request) {
    // ...
    verifier := oauth2.GenerateVerifier() // a random PKCE verifier, unique to this login attempt
    state := randString()                 // guards the redirect back against CSRF
    nonce := randString()                 // ties whatever ID token comes back to this exact attempt

    authURL := a.oauth2Cfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oidc.Nonce(nonce))
    http.Redirect(w, r, authURL, http.StatusFound) // send the browser to the IdP
}
```

The IdP authenticates the user and redirects back with a code. `HandleCallback` exchanges that code for tokens, verifies the ID token it gets back against the nonce above, and drops it into the session. Nothing downstream trusts this token yet, though; it only proves identity to this one app.

Try it: with the app still running, open a second terminal and run:

```shell
curl -i http://localhost:8080/login
```

The response is a `302 Found`. Its `Location` header is the IdP's authorize URL, `https://idp.xaa.dev/authorize?...`. Find `code_challenge` (the PKCE challenge, derived from the verifier), `state`, and `nonce` in it. `HandleLogin` generated all three for this request, and they're different every time you run the command. `curl` doesn't follow the redirect, so you can read the URL without signing in.

### Exchanging the ID token for an ID-JAG with RFC 8693

This is Step 2, the actual hand-off. The app takes the ID token from Step 1 and sends it to the IdP, asking to trade it for an ID-JAG, a short-lived, signed statement that this exact user is who they claim to be.

```go
// internal/xaa/tokenexchange.go
func exchangeForJAG(ctx context.Context, cfg config.XaaConfig, idToken string) (string, error) {
    fields := url.Values{
        "grant_type":           {"urn:ietf:params:oauth:grant-type:token-exchange"}, // this is a token exchange, per RFC 8693
        "requested_token_type": {"urn:ietf:params:oauth:token-type:id-jag"},          // ask specifically for an ID-JAG
        "subject_token":        {idToken},                                            // the ID token proving who signed in
        "subject_token_type":   {"urn:ietf:params:oauth:token-type:id_token"},
        "audience":             {strings.TrimRight(cfg.AuthServerURL, "/")},          // who must trust the ID-JAG
        "resource":             {strings.TrimRight(cfg.McpServerURL, "/")},           // the server the app ultimately wants to reach
        "client_id":            {cfg.ClientID},                                       // same client ID used for the OIDC login above
    }
    return postForm(ctx, strings.TrimRight(cfg.IdpBaseURL, "/")+"/token", fields)
}
```
The version in the repo also adds `scope` and `client_secret` to the request when they're set in `config.json`. If the IdP's policy allows it, it signs the ID-JAG and sends it back. That JWT is the app's ticket to the next server.

Try it: on the dashboard, find the **Step 2, Token Exchange (RFC 8693)** entry. While it runs, the entry briefly shows the `audience` and `resource` being sent, which come from `authServerUrl` and `mcpServerUrl` in your `config.json`. When it finishes, it turns green and reads "ID-JAG assertion issued by IdP" with the time it took. The dashboard doesn't display the ID-JAG itself, only that the IdP issued one.

### Exchanging the ID-JAG for an access token with RFC 7523

This is Step 3. An ID-JAG is useless against the MCP server directly. The resource's own authorization server, a different server than the one that just issued it, has to redeem the ID-JAG again.

```go
// internal/xaa/tokenexchange.go
func requestAccessToken(ctx context.Context, cfg config.XaaConfig, jag string) (string, error) {
    fields := url.Values{
        "grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, // RFC 7523's JWT bearer grant
        "assertion":  {jag},                                           // the ID-JAG from Step 2
        "client_id":  {cfg.McpClientID},                                // a different client ID than Step 2 used
    }
    endpoint := strings.TrimRight(cfg.AuthServerURL, "/") + "/token"
    return postForm(ctx, endpoint, fields)
}
```
Both trades chain into one function the rest of the app calls:

```go
// internal/xaa/tokenexchange.go
func GetAccessToken(ctx context.Context, cfg config.XaaConfig, idToken string) (string, error) {
    jag, err := exchangeForJAG(ctx, cfg, idToken)
    if err != nil {
        return "", err
    }
    return requestAccessToken(ctx, cfg, jag)
}
```

Call `GetAccessToken` once, and an ID token walks out the other side as an access token good for one specific MCP server. The user never sees a second login or consent screen for any of it.

Try it: on the dashboard, find the **Step 3, Access Token Request (RFC 7523)** entry. When it finishes, it reads "Bearer token issued (aud: ...)". Below the step list, the **Access Token** box shows the first 50 characters of the token, and **Token Claims** shows its `iss`, `aud`, and `sub`. Check that `aud` matches the `mcpServerUrl` in your `config.json`. That means the resource server's authorization server accepted the ID-JAG and issued a token meant for this MCP server.

### Calling the MCP server

This is Step 4, the final one. With that access token in hand, the app finally talks to the MCP server, using the official [MCP Go SDK](https://github.com/modelcontextprotocol/go-sdk). The SDK's `StreamableClientTransport` has no built-in field for a bearer token, so AI Notes Assistant wraps the underlying `http.Client` in a small custom transport:

```go
// internal/mcpnotes/client.go
type bearerTransport struct {
    token string
    base  http.RoundTripper
}

func (t *bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
    req = req.Clone(req.Context())
    req.Header.Set("Authorization", "Bearer "+t.token) // attach the access token from Step 3
    base := t.base
    if base == nil {
        base = http.DefaultTransport
    }
    return base.RoundTrip(req)
}
```

With that transport in place, connecting and reading the data takes a few calls (the repo version also lists the server's resources and parses the response, which this excerpt skips):

```go
// internal/mcpnotes/client.go
func Fetch(ctx context.Context, cfg config.XaaConfig, accessToken string) (*FetchResult, error) {
    httpClient := &http.Client{Transport: &bearerTransport{token: accessToken}} // accessToken is the Fetch parameter, from Step 3
    transport := &mcp.StreamableClientTransport{Endpoint: cfg.McpServerURL, HTTPClient: httpClient}

    client := mcp.NewClient(&mcp.Implementation{Name: "oktane-go-mcp-xaa", Version: "1.0.0"}, nil)
    session, err := client.Connect(ctx, transport, nil)                                     // MCP handshake: protocol version + capabilities
    result, err := session.ReadResource(ctx, &mcp.ReadResourceParams{URI: cfg.ResourceURI}) // fetch the actual to-do data
    // ...
}
```

The XAA playground's resource server only speaks to-dos, not notes, so AI Notes Assistant reshapes each item into a note before it ever reaches the screen.

Try it: on the dashboard, find the **Step 4, MCP Server (Streamable HTTP)** entry. When it finishes, it reads "N note(s) from MCP Server", where N is the number of to-do items returned from the `todo0://todos` resource in your `config.json`. Those items appear in the notes list, reshaped by `parseTodosAsNotes`.

Step 1 runs in `HandleLogin` and `HandleCallback` when you click **Sign in**. Steps 2 through 4 run inside one handler, `FlowHandler`, when you click **Analyze My Notes**; it calls `GetAccessToken` and then `Fetch`, and streams each step to the dashboard. From the browser it looks like two clicks, and the token exchanges happen in between without any extra prompt.

## Learn more about secure AI agent development with Go and MCP

One login, two token trades most users never notice, and a working connection to a server that had no reason to trust this app a second earlier. That's the experience more organizations are adopting XAA to deliver.

A few places to keep exploring:

- Read through the full source in the [okta-go-mcp-xaa-lab repository](https://github.com/oktadev/okta-go-mcp-xaa-lab)
- Register your own app and poke at the flow yourself at [xaa.dev](https://xaa.dev)
- Read the policy and architecture side of this story in [Integrate Your Enterprise AI Tools with Cross App Access](/blog/2025/06/23/enterprise-ai)

XAA is still a young standard, but the parts that matter here, the token exchange and the policy check, are solid enough to build on today. If you're wiring an AI agent to reach past your own app's boundary, this is worth trying before you fall back to a shared API key.

Remember to follow us on [X](https://x.com/oktadev) and subscribe to our [YouTube channel](https://www.youtube.com/c/OktaDev/) for more exciting content. We also want to hear from you about the topics you'd like to see and any questions you may have. Leave us a comment below!