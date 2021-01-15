
# Apogee Static Site Generator

Highly configurable and scriptable static site generator.

Features:

* Configurable at every step of the way with custom `ContentHandler`s (written in TS or JS, and with full access to the Apogee instance at runtime.)
* No template engines! We already have a powerful template engine that can run arbitrary code. It's called JavaScript (or TypeScript, if you prefer.)
* Automatic content watching and recompilation (still WIP.)

# TODO

* **Content watching!**
  This is a *critical* feature that is currently missing.
  The plan is to support any content changes at runtime, and automatically rebuild only the subset of pages that changed, or pages the user is viewing.
  It's not perfect (since the handlers are Turing-complete, any handler can change any file.)
* **Markdown plugins** to allow for much more robust linking and image support.

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
