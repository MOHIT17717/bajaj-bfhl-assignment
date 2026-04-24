const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// my details
const USER_ID = "mohitsk_08052006";
const EMAIL = "ms1131@srmist.edu.in";
const ROLL = "RA2311003020514";

// main endpoint
app.post("/bfhl", (req, res) => {
  try {
    const data = req.body.data;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }

    const invalidEntries = [];
    const duplicateEdges = [];
    const seenEdges = new Set();
    const validEdges = [];

    // validate and remove duplicates
    for (let raw of data) {
      if (typeof raw !== "string") {
        invalidEntries.push(String(raw));
        continue;
      }
      const entry = raw.trim();

      // skip empty
      if (entry === "") {
        invalidEntries.push(raw);
        continue;
      }

      // check format: single uppercase letter -> single uppercase letter
      const match = entry.match(/^([A-Z])->([A-Z])$/);
      if (!match) {
        invalidEntries.push(raw);
        continue;
      }

      const parent = match[1];
      const child = match[2];

      // no self loops allowed
      if (parent === child) {
        invalidEntries.push(raw);
        continue;
      }

      const key = parent + "->" + child;

      // already seen this edge?
      if (seenEdges.has(key)) {
        if (!duplicateEdges.includes(key)) {
          duplicateEdges.push(key);
        }
        continue;
      }

      seenEdges.add(key);
      validEdges.push({ parent, child });
    }

    // build the graph - first parent wins if a child has multiple parents
    const childHasParent = {};
    const adjList = {};
    const allNodes = new Set();

    for (const edge of validEdges) {
      allNodes.add(edge.parent);
      allNodes.add(edge.child);

      // skip if this child already has a parent (diamond case)
      if (childHasParent[edge.child] !== undefined) {
        continue;
      }

      childHasParent[edge.child] = edge.parent;

      if (!adjList[edge.parent]) adjList[edge.parent] = [];
      adjList[edge.parent].push(edge.child);
    }

    // group nodes into connected components using BFS
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
    const components = [];

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

    // process each component - check for cycles, build trees
    const hierarchies = [];
    let totalTrees = 0;
    let totalCycles = 0;
    let largestDepth = 0;
    let largestRoot = null;

    for (const comp of components) {
      // roots = nodes that are not anyone's child
      const roots = comp.filter((n) => childHasParent[n] === undefined);

      if (roots.length === 0) {
        // no root found = pure cycle
        totalCycles++;
        const root = comp.sort()[0]; // pick alphabetically smallest
        hierarchies.push({
          root: root,
          tree: {},
          has_cycle: true,
        });
        continue;
      }

      // DFS to check for cycles
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

      // valid tree - build it and find depth
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

      // update largest if needed
      if (
        depth > largestDepth ||
        (depth === largestDepth && (largestRoot === null || root < largestRoot))
      ) {
        largestDepth = depth;
        largestRoot = root;
      }
    }

    // summary
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
