const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// -------- your details (change these) --------
const USER_ID = "mohitsk_08052006";
const EMAIL = "ms1131@srmist.edu.in";
const ROLL = "RA2311003020514";

// POST /bfhl
app.post("/bfhl", (req, res) => {
  try {
    const data = req.body.data;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }

    const invalidEntries = [];
    const duplicateEdges = [];
    const seenEdges = new Set();
    const validEdges = []; // {parent, child} in order

    // Step 1 — validate & deduplicate
    for (let raw of data) {
      if (typeof raw !== "string") {
        invalidEntries.push(String(raw));
        continue;
      }
      const entry = raw.trim();

      // empty string
      if (entry === "") {
        invalidEntries.push(raw);
        continue;
      }

      // must match X->Y exactly (single uppercase letters)
      const match = entry.match(/^([A-Z])->([A-Z])$/);
      if (!match) {
        invalidEntries.push(raw);
        continue;
      }

      const parent = match[1];
      const child = match[2];

      // self-loop
      if (parent === child) {
        invalidEntries.push(raw);
        continue;
      }

      const key = parent + "->" + child;

      // duplicate check
      if (seenEdges.has(key)) {
        if (!duplicateEdges.includes(key)) {
          duplicateEdges.push(key);
        }
        continue;
      }

      seenEdges.add(key);
      validEdges.push({ parent, child });
    }

    // Step 2 — build adjacency list (first parent wins for diamond cases)
    const childHasParent = {}; // child -> parent (first one wins)
    const adjList = {};        // parent -> [children]
    const allNodes = new Set();

    for (const edge of validEdges) {
      allNodes.add(edge.parent);
      allNodes.add(edge.child);

      // diamond / multi-parent: skip if child already has a parent
      if (childHasParent[edge.child] !== undefined) {
        continue;
      }

      childHasParent[edge.child] = edge.parent;

      if (!adjList[edge.parent]) adjList[edge.parent] = [];
      adjList[edge.parent].push(edge.child);
    }

    // Step 3 — find connected components
    // build undirected neighbor map for grouping
    const neighbors = {};
    for (const node of allNodes) {
      neighbors[node] = new Set();
    }
    for (const node of allNodes) {
      if (adjList[node]) {
        for (const ch of adjList[node]) {
          neighbors[node].add(ch);
          neighbors[ch].add(node);
        }
      }
    }

    const visited = new Set();
    const components = []; // each is an array of nodes

    for (const node of allNodes) {
      if (visited.has(node)) continue;
      const queue = [node];
      const comp = [];
      visited.add(node);
      while (queue.length > 0) {
        const cur = queue.shift();
        comp.push(cur);
        for (const nb of neighbors[cur]) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      components.push(comp);
    }

    // Step 4 — process each component
    const hierarchies = [];
    let totalTrees = 0;
    let totalCycles = 0;
    let largestDepth = 0;
    let largestRoot = null;

    for (const comp of components) {
      // find roots in this component (nodes that are not a child of anyone)
      const roots = comp.filter((n) => childHasParent[n] === undefined);

      if (roots.length === 0) {
        // pure cycle — every node is someone's child
        totalCycles++;
        const root = comp.sort()[0]; // lexicographically smallest
        hierarchies.push({
          root: root,
          tree: {},
          has_cycle: true,
        });
        continue;
      }

      // check for cycles using DFS
      let hasCycle = false;
      const visitedDFS = new Set();
      const recStack = new Set();

      function dfsCheck(node) {
        visitedDFS.add(node);
        recStack.add(node);
        if (adjList[node]) {
          for (const ch of adjList[node]) {
            if (!visitedDFS.has(ch)) {
              if (dfsCheck(ch)) return true;
            } else if (recStack.has(ch)) {
              return true;
            }
          }
        }
        recStack.delete(node);
        return false;
      }

      for (const r of roots) {
        if (dfsCheck(r)) {
          hasCycle = true;
          break;
        }
      }

      if (hasCycle) {
        totalCycles++;
        const root = roots.sort()[0];
        hierarchies.push({
          root: root,
          tree: {},
          has_cycle: true,
        });
        continue;
      }

      // no cycle — build the tree and calculate depth
      const root = roots.sort()[0];

      function buildTree(node) {
        const obj = {};
        if (adjList[node]) {
          for (const ch of adjList[node]) {
            obj[ch] = buildTree(ch);
          }
        }
        return obj;
      }

      function calcDepth(node) {
        if (!adjList[node] || adjList[node].length === 0) return 1;
        let maxChild = 0;
        for (const ch of adjList[node]) {
          maxChild = Math.max(maxChild, calcDepth(ch));
        }
        return 1 + maxChild;
      }

      const tree = {};
      tree[root] = buildTree(root);
      const depth = calcDepth(root);

      totalTrees++;
      hierarchies.push({ root, tree, depth });

      // track largest tree
      if (
        depth > largestDepth ||
        (depth === largestDepth && (largestRoot === null || root < largestRoot))
      ) {
        largestDepth = depth;
        largestRoot = root;
      }
    }

    // build summary
    const summary = {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestRoot || "",
    };

    return res.json({
      user_id: USER_ID,
      email_id: EMAIL,
      college_roll_number: ROLL,
      hierarchies,
      invalid_entries: invalidEntries,
      duplicate_edges: duplicateEdges,
      summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
