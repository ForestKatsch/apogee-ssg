
# Apogee Static Site Generator

Highly configurable and scriptable static site generator.

Features:

* Configurable at every step of the way with custom `ContentHandler`s (written in TS or JS, and with full access to the Apogee instance at runtime.)
* No template engines! We already have a powerful template engine that can run arbitrary code. It's called JavaScript (or TypeScript, if you prefer.)
* Automatic content watching and recompilation (still WIP.)

## Operation

Every output page in the final build corresponds 1:1 with a `Page`.
Pages can be created anywhere in the build process, or automatically created from an input file.

### Content ingestion
When Apogee is invoked, it first scans the [**content path**](#content-path) for valid files.
For each input file, a new `Page` is created with the input file as the `Source`.

# Configuration

```toml
# Where to read content from.
# In this case, `./content` is the content root.
[content]
path = "./content"

# An (optional) list of filename patterns to ignore, in the format of `.gitignore`.
ignore = []

# Handlers must be declared here.
# The name can be any arbitrary string; Apogee doesn't care what you call the handlers.
# Here, we declare any file with a `.md` extension should be handled by the markdown handler.
[handler.markdown]
extensions = [".md"]
handler = "./handler/markdown.js"

# Where output files are written to.
[output]
path = "dist"
```

# License

All rights reserved.
