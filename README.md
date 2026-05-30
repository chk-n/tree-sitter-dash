# tree-sitter-dash

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
[Dash](https://github.com/chk-n/dash) programming language.

Dash source files use the `.ds` extension.

## Development

The grammar is defined in `grammar.js`. After editing it, regenerate the
parser:

```sh
tree-sitter generate --abi 14
tree-sitter test
```

The generated parser (`src/parser.c`, `src/grammar.json`, `src/node-types.json`)
is committed to the repo so that consumers — such as editors — can build the
grammar without running the tree-sitter CLI themselves. **Always commit the
regenerated `src/` files** alongside changes to `grammar.js`.

### ⚠️ ABI version: always generate with `--abi 14`

Tree-sitter CLI 0.25+ defaults to emitting **ABI 15** parsers, but
**Helix 25.01 only supports tree-sitter ABI 13–14**. An ABI 15 parser fails to
load in Helix with:

```
Incompatible language version 15. Expected minimum 13, maximum 14
```

When this happens Helix rejects the whole language and **all highlighting
silently disappears** (the parser, not the queries, is the problem — so
`hx --health dash` can still show queries as ✓).

There is no persistent ABI setting in `tree-sitter.json` for this CLI version;
the ABI is chosen only at generation time. So the pin must be applied on every
regeneration, either via the flag or the environment variable:

```sh
tree-sitter generate --abi 14
# or, equivalently:
TREE_SITTER_ABI_VERSION=14 tree-sitter generate
```

The committed `src/parser.c` should show `#define LANGUAGE_VERSION 14`. Drop the
`--abi 14` constraint only once the target Helix release supports ABI 15.

## Using the grammar in Helix

Helix pins each grammar to a specific commit, so pushing new commits is not
enough — you must bump the `rev` and rebuild.

1. In `~/.config/helix/languages.toml`, point the grammar at the desired commit:

   ```toml
   [[language]]
   name = "dash"
   scope = "source.dash"
   file-types = ["ds"]

   [[grammar]]
   name = "dash"
   source = { git = "https://github.com/chk-n/tree-sitter-dash", rev = "<commit-sha>" }
   ```

2. Fetch and build the grammar:

   ```sh
   hx --grammar fetch
   hx --grammar build
   ```

3. Copy the highlight queries into Helix's runtime directory (fetch/build only
   handles the parser, not the queries):

   ```sh
   cp queries/*.scm ~/.config/helix/runtime/queries/dash/
   ```

4. Restart Helix and verify with `hx --health dash`.
