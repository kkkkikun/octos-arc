"""「还够不够再来一轮修复」要按这个模型自己的表现算，不是按一个猜的常数。

原先是固定的 `min_repair_seconds`（默认 300）。意图对——代码注释写明「只剩几分钟才开始的
修复轮同样会超时，不如保住最好的状态」——但数字是猜的。keep @ D 实测一轮修复约 600 秒，
是那个常数的两倍。猜小了不是保守而是**反过来**：只剩 300–600 秒时会放行一轮注定被砍断的
修复，什么都留不下，时间也没了。
"""
import unittest

import main


class _Flow:
    min_repair_seconds = 300
    repair_needs = main.Flow.repair_needs

    def __init__(self, durations=None):
        if durations is not None:
            self.repair_durations = durations


class RepairNeedsTests(unittest.TestCase):
    def test_falls_back_to_the_floor_before_any_measurement(self):
        """还没跑过修复轮时，行为与原先一致。"""
        self.assertEqual(_Flow().repair_needs(), 300.0)
        self.assertEqual(_Flow([]).repair_needs(), 300.0)

    def test_uses_the_measured_median_with_headroom(self):
        """keep 实测约 600 秒 → 判断门槛应抬到 600 以上，而不是停在 300。"""
        f = _Flow([600, 610, 590])
        self.assertAlmostEqual(f.repair_needs(), 600 * 1.1)
        self.assertGreater(f.repair_needs(), 300, "这正是原先放行注定失败的修复的区间")

    def test_never_goes_below_the_configured_floor(self):
        """模型很快时也不会把门槛降到下限以下——这条改动只会让判断更严，不会更松。"""
        f = _Flow([10, 12, 11])
        self.assertEqual(f.repair_needs(), 300.0)

    def test_even_count_uses_the_average_of_the_middle_two(self):
        f = _Flow([400, 800])
        self.assertAlmostEqual(f.repair_needs(), 600 * 1.1)

    def test_ignores_junk_values(self):
        f = _Flow([0, None, -5, 600, 600])
        self.assertAlmostEqual(f.repair_needs(), 600 * 1.1)

    def test_only_recent_turns_are_kept(self):
        """模型和题目会变；很久以前的耗时不该继续影响现在的决定。
        记录点保留最近 12 轮。"""
        import inspect
        src = inspect.getsource(main.Flow.turn)
        self.assertIn("[-12:]", src)
        self.assertIn('"repair" in label or "rewrite" in label', src)

    def test_the_gate_uses_it(self):
        import inspect
        src = inspect.getsource(main.Flow.acceptance_loop)
        self.assertIn("left < self.repair_needs()", src)
        self.assertNotIn("left < self.min_repair_seconds", src)
