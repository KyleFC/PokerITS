import json
from pathlib import Path

SCENARIOS_FILE = Path(__file__).resolve().parent.parent / 'scenarios.json'

class TestScenariosJSON:
    def test_scenarios_exist_and_is_valid_json(self):
        assert SCENARIOS_FILE.exists()
        with open(SCENARIOS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) >= 8

    def test_scenarios_have_required_fields(self):
        with open(SCENARIOS_FILE, 'r', encoding='utf-8') as f:
            scenarios = json.load(f)
        
        required_fields = {
            'id', 'skill', 'title', 'description', 'hole_cards',
            'board', 'question', 'options', 'correct_answer', 'explanation'
        }
        
        ids = set()
        skills = set()
        
        for idx, scenario in enumerate(scenarios):
            # Check all required fields are present
            for field in required_fields:
                assert field in scenario, f"Scenario at index {idx} is missing field: {field}"
            
            # Check id uniqueness
            scenario_id = scenario['id']
            assert scenario_id not in ids, f"Duplicate scenario ID found: {scenario_id}"
            ids.add(scenario_id)
            
            # Check skill is one of the valid ones
            skill = scenario['skill']
            assert skill in {
                'preflop_range', 'equity_estimation', 'pot_odds', 'implied_odds', 'mdf'
            }, f"Invalid skill in scenario {scenario_id}: {skill}"
            skills.add(skill)
            
            # Check correct_answer is one of the options
            assert scenario['correct_answer'] in scenario['options'], \
                f"Correct answer not in options list for scenario {scenario_id}"

        # Check that all 5 skills are represented
        assert len(skills) == 5, f"Not all 5 skills are represented in scenarios (found {len(skills)})"
