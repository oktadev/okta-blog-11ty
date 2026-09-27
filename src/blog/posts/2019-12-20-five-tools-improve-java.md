---
disqus_thread_id: 7772363163
discourse_topic_id: 17188
discourse_comment_url: https://devforum.okta.com/t/17188
title: "Five Tools to Improve Your Java Code"
author: brian-demers
by: advocate
communities: [java]
description: "Five great tools to reduce bugs and make your Java code more secure!"
tags: [java, ci, builds, secure]
tweets:
- "These 5 Java tools will help you reduce bugs!"
- "Test coverage, static analysis and more, 5 tools every Java developer should know!"
- "Improve your Java code quality the easy way, automate it!"
image: five-tools-improve-java/stop-bad-code.png
type: awareness
---
Writing quality code takes practice. To write better code, you need to know what should improve. Code quality and what makes code easy to read are very subjective; ask five different developers, you will get six different answers. For this post, I'll avoid most of the subjective and focus on ways to detect real issues and potential bugs.

I wrote some intentionally bad code to demo these tools (which was harder than you might think). If you cannot wait and just want to see the code, you can grab it on [GitHub](https://github.com/oktadeveloper/okta-java-tools-example). Clone the project and run `./mvnw verify` and you will see the issues.

If you'd rather watch a video, I [created a screencast too](https://youtu.be/_VCJ8jCRVWo)!

<div style="text-align: center; margin-bottom: 1.25rem">
<iframe width="700" height="394" style="max-width: 100%" src="https://www.youtube.com/embed/_VCJ8jCRVWo" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

First, it's always a good idea to start with tests!

[[toc]]

## 1. Add Test Coverage with JaCoCo

Many projects aim for 100% test coverage. This metric can be deceiving, a low coverage score is generally a bad sign, but a high score doesn't say anything about the quality of tests. There is a point of diminishing returns where you start writing tests just to hit an arbitrary coverage number. You should instead use test coverage to find problems and give you confidence in the quality of your code.

There are a few coverage options in Java-land, but my favorite has been [JaCoCo](https://www.eclemma.org/jacoco/) (originally named EclEmma, which is still in the URL).

JaCoCo runs as a Java Agent, which makes it easy to add to any test framework (or any `java` execution). For Maven-based projects you simply add the [JaCoCo Maven Plugin](https://www.eclemma.org/jacoco/trunk/doc/maven.html") to your `pom.xml`:

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.5</version>
    <executions>
        <!-- prepare the agent -->
        <execution>
            <id>prepare-agent</id>
            <phase>process-test-classes</phase>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>

        <!-- If you have integration tests run with the `failsafe-maven-plugin`
               use `prepare-agent-integration` -->
        <execution>
            <id>prepare-agent-integration</id>
            <phase>pre-integration-test</phase>
            <goals>
                <goal>prepare-agent-integration</goal>
            </goals>
        </execution>

        <!-- generate an HTML report -->
        <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

Run `mvn verify` to generate the report in `target/site/jacoco/index.html`.

{% img {src: "five-tools-improve-java/jacoco-package.png", alt: "JaCoCo package screen shot"} %}

Above is a screenshot of the test coverage report for this project. You can see right away that the `FiltUtility` class has no coverage and that it has more lines than `SomeUtilityClass`. If you click into `SomeUtilityClass`, you can see the tests have missed one of the branches on line 8.

{% img {src: "five-tools-improve-java/jacoco-class.png", alt: "JaCoCo class screen shot"} %}

If you have a Maven multi-module project, you can [aggregate coverage data](https://github.com/jacoco/jacoco/wiki/MavenMultiModule) across modules and even merge unit test and integration test coverage to get a picture of the full project's coverage.

## 2. Do Static Source Code Analysis with PMD

PMD is a static code analyzer that can detect potential issues such as dead code, empty blocks, complicated statements, suboptimal code, and duplicate code. PMD doesn't stand for anything; unofficially, some refer to it as "Programming Mistake Detector."

{% img {src: "five-tools-improve-java/pmd-logo.png", alt: "PMD logo", header: "400"} %}

PMD's Maven plugin one of the officially supported plugins in the Apache Maven project and comes with a robust set of default rules; however, if you are not happy with these rules, you can change them or [define your own](https://pmd.github.io/pmd/pmd_userdocs_making_rulesets.html). The basic configuration for a `pom.xml` is as follows:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-pmd-plugin</artifactId>
    <version>3.12.0</version>
    <executions>
        <execution>
            <id>pmd-scan</id>
            <phase>verify</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

Now run `mvn verify` or just `mvn pmd:check` on a project with the following Java class:

<div class="example">

```java
package com.okta.examples;

import java.io.File;
import java.io.FileWriter;; // <1>
import java.io.IOException;
import java.io.BufferedOutputStream; // <2>

public class FileUtility {

    private static void toFile_bad(String contents, File file) throws IOException { // <3>
        FileWriter fileWriter = new FileWriter(file);
        fileWriter.write(contents);
    }
}
```

1. Empty statement `;;` - delete the trailing `;`.
2. Unused import - remove line.
3. Unused private method - dead code, consider deleting.
{.colist}

</div>

These are just a few common issues usually caused by removing code, or cut/paste errors. Check out the PMD docs for [full list of rules](https://pmd.github.io/latest/pmd_rules_java.html) it supports.

PMD doesn't detect all the issues with this code though, the observant reader may have noticed a few bigger problems. To detect those, we can use SpotBugs.

## 3. Conduct Bytecode Analysis with SpotBugs and Find Security Bugs

{% img {src: "five-tools-improve-java/spotbugs-logo.png", alt: "SpotBugs logo", header: "600"} %}

SpotBugs checks bytecode, whereas PMD scans source files, this means anything the compiler throws away (unused imports or example) would not be reported by SpotBugs. The SpotBugs project is an updated version of FindBugs, many items in the documentation still reference "FindBugs." For those of you still using FindBugs, [updating to SpotBugs](https://spotbugs.readthedocs.io/en/stable/migration.html) is trivial.

SpotBugs also has a few plugins, my favorite being "Find Security Bugs", and as you might guess, it helps you detect security issues like weak hash functions, file/path traversals, untrusted inputs, [and many more](https://find-sec-bugs.github.io/bugs.htm).

To add SpotBugs (and Find Security Bugs) to a Maven project, add the following to your `pom.xml`:

<div class="example">

```xml
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>3.1.12.2</version>
    <configuration>
        <effort>Max</effort>
        <threshold>Low</threshold>
        <failOnError>true</failOnError>
        <plugins>
            <plugin>
                <groupId>com.h3xstream.findsecbugs</groupId>
                <artifactId>findsecbugs-plugin</artifactId> <!--1-->
                <version>1.10.1</version>
            </plugin>
        </plugins>
    </configuration>
    <executions>
        <execution>
            <id>scan</id>
            <phase>verify</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

1. Find Security Bugs is a plugin to a plugin 🤯
{.colist}

</div>

When we scan the same code as above using `mvn compile spotbugs:check`, typically you would just run `mvn verify`, however, we haven't fixed the PMD issues above yet.

> **TIP:** You can skip PMD using the command line arg `-Dpmd.skip`, similarly with SpotBugs, `-Dspotbugs.skip`. For example: `mvn verify -Dpmd.skip -Dspotbugs.skip` would skip both.

<div class="example">

```java
package com.okta.examples;

import java.io.File;
import java.io.FileWriter;;
import java.io.IOException;
import java.io.BufferedOutputStream;

public class FileUtility {

    private static void toFile_bad(String contents, File file) throws IOException { // <3>
        FileWriter fileWriter = new FileWriter(file); // <1> <2>
        fileWriter.write(contents);
    }
}
```

1. Default encoding used, use `UTF8` or other Charset.
2. Failed to close FileWriter, consider using a try-with-resources block.
3. Unused private method - dead code, consider deleting.
{.colist}

</div>

You can see from the results there is some overlap between PMD and SpotBugs, but the latter was able to detect that `FileWriter` wasn't closed.

If we clean up our code we are left with:

**FileUtility.java**

```java
package com.okta.examples;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import static java.nio.charset.StandardCharsets.UTF_8;

public class FileUtility {

    public static void toFile_better(String contents, File file) throws IOException {
        try (Writer writer = new OutputStreamWriter(new FileOutputStream(file), UTF_8)) {
            writer.write(contents);
        }
    }
}
```

> **TIP:** This could be written more succinctly using `Files.write()`, or with Java 11, `new FileWriter(file, UTF_8)`.

## 4. Ensure Backward Compatibility and Semantic Versioning with japicmp

Ensuring backward compatibility is difficult, there are many nuances that even a well-trained eye will miss. To add more complexity, Java has a notion of "source" compatibility and "binary" compatibility. Source compatibility means your code will compile without changes, whereas binary means it will run without modification. However, there are some exceptions to this rule too:

> Adding a default method, or changing a method from abstract to default, does not break compatibility with pre-existing binaries, but may cause an `IncompatibleClassChangeError` if a pre-existing binary attempts to invoke the method.
>
> — The Java Language Specification, Chapter 13 - Binary Compatibility

Usually, this is safe to ignore, but I point this out to help explain the complexity of this topic. If you want to ensure backward compatibility, you need a tool to help, and I strongly recommend [japicmp](https://siom79.github.io/japicmp/).

Showing a full-blown example of is a outside the scope of this post, but here is a snippet from a Maven `pom.xml` configuration:

<div class="example">

```xml
<plugin>
    <groupId>com.github.siom79.japicmp</groupId>
    <artifactId>japicmp-maven-plugin</artifactId>
    <version>0.14.2</version>
    <configuration>
        <oldVersion>
            <dependency> <!--1-->
                <groupId>${project.groupId}</groupId>
                <artifactId>${project.artifactId}</artifactId>
                <version>${previousVersion}</version>
                <type>jar</type>
            </dependency>
        </oldVersion>
        <parameter>
            <onlyModified>true</onlyModified>
            <!--2-->
            <breakBuildOnBinaryIncompatibleModifications>true</breakBuildOnBinaryIncompatibleModifications>
            <!--3-->
            <breakBuildBasedOnSemanticVersioning>true</breakBuildBasedOnSemanticVersioning>
            <!--4-->
            <postAnalysisScript>src/japicmp/postAnalysisScript.groovy</postAnalysisScript>
        </parameter>
    </configuration>
    <executions>
        <execution>
            <id>japicmp</id>
            <goals>
                <goal>cmp</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

1. The previous version's dependency block to compare against.
2. `breakBuildOnBinaryIncompatibleModifications` - fail the build on any backward-incompatible changes.
3. `breakBuildBasedOnSemanticVersioning` - fail based on semver rules. For example, if your public API changes in a way that would require a "minor" version change.
4. `postAnalysisScript` - Optional, allows use of a custom Groovy script to modify the results based on your own needs. If you want to allow new default methods in interfaces, you would need a script similar to this:
{.colist}

**src/japicmp/postAnalysisScript.groovy**

```groovy
import static japicmp.model.JApiCompatibilityChange.*
import static japicmp.model.JApiChangeStatus.*

def it = jApiClasses.iterator()
while (it.hasNext()) {
    def jApiClass = it.next()

    if (jApiClass.getChangeStatus() != UNCHANGED) {
        def methodIt = jApiClass.getMethods().iterator()
        while (methodIt.hasNext()) {
            def method = methodIt.next()
            def methodChanges = method.getCompatibilityChanges()
            methodChanges.remove(METHOD_NEW_DEFAULT)
        }
    }
}
return jApiClasses
```

</div>

Take a look at the [japicmp project documentation](https://siom79.github.io/japicmp/) for more examples.

## 5. Don't Skip Code Reviews

Using the above tools can help make your code reviews more effective. The goal should be to automate as much as possible out of your code review so that the human element can shine through. Have you ever asked, "is there a test for this" in a code review? Automate that, send your coverage data to a tool like [Codecov](https://codecov.io/), which can add the coverage delta to your pull requests. If your project has strict code style guidelines, you can use [Checkstyle](https://checkstyle.org/).

Code reviews are great; they provide an opportunity for both the author and the reviewer to learn from each other and ask questions, suggest alternatives, or discuss other architectural topics. The reviewer shouldn't be wasting time checking for things that a program can detect.

> **TIP:** Keep the number of changes in your reviews small and to the point. Nobody wants to review hundreds of potentially unrelated code changes at once.

## Bonus: Scan your Dependencies for Vulnerabilities

Your code is just a small percentage of your overall application. Dependencies (direct and indirect) make up the rest. Keeping on top of vulnerabilities in those dependencies is not something you can do manually. Luckily for us, there are several tools available to help us out.

- [OWASP Dependency Check](https://www.owasp.org/index.php/OWASP_Dependency_Check) - I've been using the Maven plugin with success for years. The only downside is there is a high rate of false-positive matches that requires updating an "exclusion" file in your repository.
- [Snyk.io](https://snyk.io/) - Offers dependency scanning, and includes additional security issues that are not official in the [NIST National Vulnerability Database](https://nvd.nist.gov/).
- [GitHub Dependabot](https://dependabot.com/) - GitHub has been rolling out Dependabot, and there is a good chance it's already scanning your public repositories. I've had mixed success in the past, specifically when it comes to Maven multi-module projects. I'm sure this will improve in the future.
- Many more! Have a favorite dependency scanner; let us know in the comments!

> **WARNING:** One key thing to remember the code in your repository doesn't always match the code that is running in production. Make sure you track the dependencies in your production code too!

## Want More Secure Applications? Learn More!

Using the tools in this post will help you write better (and more secure) Java code. Many of the issues detected also provide excellent examples of how to fix the problems, which is a great way to learn. You can also integrate most of them in your IDE so you can see the issues as soon as you type them.

This is just the tip of the iceberg. There are many other great projects; for example, [SonarLint](https://www.sonarlint.org/)'s IntelliJ plugin is excellent and will detect many of the issues I showed above.

If you liked this post check out our related content:

- [Semantic Versioning Sucks! Long Live Semantic Versioning](/blog/2019/12/16/semantic-versioning)
- [10 Excellent Ways to Secure Your Spring Boot Application](/blog/2018/07/30/10-ways-to-secure-spring-boot)
- [Tutorial: Develop Apps with Secure WebSockets in Java](/blog/2019/10/09/java-spring-websocket-tutorial)
- [Simple Authentication with Spring Security](/blog/2019/05/31/spring-security-authentication)
- [A Quick Guide to Spring Boot Login Option](/blog/2019/05/15/spring-boot-login-options)

For more posts like this one, follow [@oktadev](https://twitter.com/oktadev) on Twitter, follow us [on LinkedIn](https://www.linkedin.com/company/oktadev/), or subscribe to [our YouTube channel](https://www.youtube.com/c/oktadev).
