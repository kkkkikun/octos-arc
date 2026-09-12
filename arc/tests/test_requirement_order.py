import unittest

from requirement_order import (
    ancestors_of,
    flatten_atomic,
    node_fingerprint,
    topo_order,
)


def tree(children):
    return {"id": "ROOT", "type": "FOLDER", "children": children}


def atomic(node_id, deps=(), **extra):
    node = {"id": node_id, "type": "ATOMIC", "name": node_id, "dependencies": list(deps)}
    node.update(extra)
    return node


class TopoOrderTests(unittest.TestCase):
    def test_should_keep_tree_order_when_no_dependencies(self):
        t = tree([atomic("REQ-1"), atomic("REQ-2"), atomic("REQ-3")])
        self.assertEqual([n["id"] for n in topo_order(t)], ["REQ-1", "REQ-2", "REQ-3"])

    def test_should_place_dependency_before_dependent_when_tree_order_is_reversed(self):
        t = tree([atomic("REQ-2", ["REQ-3"]), atomic("REQ-3"), atomic("REQ-1", ["REQ-2"])])
        self.assertEqual([n["id"] for n in topo_order(t)], ["REQ-3", "REQ-2", "REQ-1"])

    def test_should_expand_folder_dependency_to_its_atomic_descendants(self):
        folder = {"id": "F-1", "type": "FOLDER", "children": [atomic("REQ-1"), atomic("REQ-2")]}
        t = tree([atomic("REQ-3", ["F-1"]), folder])
        self.assertEqual([n["id"] for n in topo_order(t)], ["REQ-1", "REQ-2", "REQ-3"])

    def test_should_ignore_unknown_and_self_dependencies(self):
        t = tree([atomic("REQ-1", ["REQ-1", "NOPE"]), atomic("REQ-2", ["REQ-1"])])
        self.assertEqual([n["id"] for n in topo_order(t)], ["REQ-1", "REQ-2"])

    def test_should_break_cycles_in_tree_order_when_dependencies_are_circular(self):
        t = tree([atomic("REQ-1", ["REQ-2"]), atomic("REQ-2", ["REQ-1"]), atomic("REQ-3")])
        # REQ-3 is genuinely ready and goes first; the cycle is then broken in tree order.
        self.assertEqual([n["id"] for n in topo_order(t)], ["REQ-3", "REQ-1", "REQ-2"])

    def test_should_treat_leaf_without_type_as_atomic(self):
        t = tree([{"id": "X", "name": "leaf"}])
        self.assertEqual([n["id"] for n in flatten_atomic(t)], ["X"])


class AncestorTests(unittest.TestCase):
    def test_should_return_transitive_dependencies_in_topological_order(self):
        t = tree([atomic("REQ-1"), atomic("REQ-2", ["REQ-1"]), atomic("REQ-3", ["REQ-2"]), atomic("REQ-4")])
        ordered = topo_order(t)
        self.assertEqual(ancestors_of("REQ-3", ordered), ["REQ-1", "REQ-2"])
        self.assertEqual(ancestors_of("REQ-4", ordered), [])


class FingerprintTests(unittest.TestCase):
    def test_should_change_when_description_changes_and_ignore_key_order(self):
        a = atomic("REQ-1", description="one", scenarios=[{"name": "s"}])
        b = {"scenarios": [{"name": "s"}], "description": "one", "dependencies": [], "name": "REQ-1", "type": "ATOMIC", "id": "REQ-1"}
        c = atomic("REQ-1", description="two", scenarios=[{"name": "s"}])
        self.assertEqual(node_fingerprint(a), node_fingerprint(b))
        self.assertNotEqual(node_fingerprint(a), node_fingerprint(c))


if __name__ == "__main__":
    unittest.main()
