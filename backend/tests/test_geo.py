import pytest

from app.geo import PolygonError, area_ha, parse_polygon, polygon_key, to_geojson
from tests.conftest import POLYGON


def test_valid_polygon_area():
    poly = parse_polygon(POLYGON)
    assert 1000 < area_ha(poly) < 1050


def test_feature_wrapper_is_accepted():
    poly = parse_polygon({"type": "Feature", "properties": {}, "geometry": POLYGON})
    assert to_geojson(poly)["type"] == "Polygon"


@pytest.mark.parametrize(
    "geojson, message",
    [
        ({"type": "Point", "coordinates": [0, 0]}, "GeoJSON Polygon"),
        ("not a polygon", "GeoJSON Polygon"),
        ({"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}, "self-intersecting"),
        ({"type": "Polygon", "coordinates": [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0]]]}, "too small"),
        ({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}, "too large"),
        ({"type": "Polygon", "coordinates": [[[0, 95], [0.1, 95], [0.1, 95.1], [0, 95]]]}, "WGS84"),
        ({"type": "Polygon", "coordinates": "garbage"}, "invalid polygon"),
    ],
)
def test_invalid_polygons(geojson, message):
    with pytest.raises(PolygonError, match=message):
        parse_polygon(geojson)


def test_polygon_key_is_stable():
    assert polygon_key(parse_polygon(POLYGON)) == polygon_key(parse_polygon(POLYGON))
