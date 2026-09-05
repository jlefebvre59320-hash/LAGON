import pytest

from p0.synthetic import make_world


@pytest.fixture(scope="session")
def world():
    return make_world(n_teams=18, seasons=(2017, 2018, 2019, 2020, 2021), seed=3)
