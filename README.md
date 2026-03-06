# SwaggerForge Spring Boot Starter

Embed the [SwaggerForge](https://github.com/your-repo/custom-swagger) API documentation UI in your Spring Boot application, similar to Swagger UI with springdoc-openapi.

## Requirements

- Spring Boot 3.x
- Java 17+
- [springdoc-openapi](https://springdoc.org/) (recommended) to expose OpenAPI at `/v3/api-docs`

## Installation

### 1. Build and install the starter (local Maven)

From the **custom-swagger** project root:

```bash
# Build the embeddable UI bundle
npm run build:embed

# Copy the bundle into the starter's static resources
cp -r dist/embed/* swagger-forge-spring-boot-starter/src/main/resources/static/swagger-forge/

# Install the starter into your local Maven repo
cd swagger-forge-spring-boot-starter
mvn install
```

### 2. Add the dependency to your Spring Boot project

```xml
<dependency>
    <groupId>com.swaggerforge</groupId>
    <artifactId>swagger-forge-spring-boot-starter</artifactId>
    <version>1.0.0-SNAPSHOT</version>
</dependency>
```

### 3. Add springdoc-openapi (if not already present)

```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

## Usage

1. Start your Spring Boot application.
2. Open **http://localhost:8080/swagger-forge** (or your server base URL).
3. The UI will load the OpenAPI spec from **/v3/api-docs** (springdoc’s default) and render the documentation.

No extra configuration is required if you use springdoc’s default API docs path.

## Publishing to GitHub Packages

### 1. One-time setup in this repo

1. **Edit `pom.xml`**  
   Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO` in the `<distributionManagement>` URLs with your GitHub username and repository name (e.g. `johndoe` and `custom-swagger`).

2. **Create a GitHub Personal Access Token (PAT)**  
   - GitHub → Settings → Developer settings → Personal access tokens  
   - Generate a token with scope **`write:packages`** (and **`read:packages`** if you want to download from GitHub Packages).  
   - Keep the token secret; do not commit it.

### 2. Publish from your machine

Add this to **`~/.m2/settings.xml`** (create the file if needed), using your real username and token:

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_TOKEN</password>
    </server>
  </servers>
</settings>
```

Then from the **swagger-forge-spring-boot-starter** directory:

```bash
# From custom-swagger project root: build UI and copy into starter, then:
cd swagger-forge-spring-boot-starter
mvn clean deploy
```

The artifact will be published to **https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO/packages**.

### 3. Publish with GitHub Actions (optional)

A workflow under `.github/workflows/publish-starter.yml` can publish the starter on release. After you fix the placeholder in `pom.xml`, push the repo and create a **Release** (tag) on GitHub; the workflow will run `mvn deploy` using the built-in `GITHUB_TOKEN`.

### 4. Using the published artifact in another project

Consumers need to add the **GitHub Packages Maven repository** and the dependency.

In their **`pom.xml`** (or in a parent / BOM):

```xml
<repositories>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/YOUR_GITHUB_USERNAME/YOUR_REPO</url>
  </repository>
</repositories>

<dependencies>
  <dependency>
    <groupId>com.swaggerforge</groupId>
    <artifactId>swagger-forge-spring-boot-starter</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </dependency>
</dependencies>
```

For **private** repos, they must add a `<server>` with the same `<id>github</id>` and a PAT with `read:packages` in their `~/.m2/settings.xml`.

## Customization

- **Spec URL**: The embedded UI loads the spec from `/v3/api-docs` by default. To use a different path, rebuild the embed bundle with a different `specUrl` in `scripts/build-embed.js` (e.g. your own docs endpoint) and rebuild the static files.
- **Base path**: The UI is served under `/swagger-forge`. The bundle is built with `basePath: '/swagger-forge'` so that JS and CSS load correctly.

## License

Same as the parent SwaggerForge project.
