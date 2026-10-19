"""Demo forests: ~1,000 ha squares of intact tropical forest with reliably clear Sentinel-2 imagery
in Aug–Oct. Their analyses are cached in backend/demo_cache so the live demo is instant."""

DEMO_FORESTS = [
    {
        "name": "Amazonas Rainforest Block (Brazil)",
        "polygon": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-60.614487, -7.21447],
                    [-60.585513, -7.21447],
                    [-60.585513, -7.18553],
                    [-60.614487, -7.18553],
                    [-60.614487, -7.21447],
                ]
            ],
        },
    },
    {
        "name": "Danum Valley Forest (Sabah, Borneo)",
        "polygon": {
            "type": "Polygon",
            "coordinates": [
                [
                    [117.775573, 4.95053],
                    [117.804427, 4.95053],
                    [117.804427, 4.97947],
                    [117.775573, 4.97947],
                    [117.775573, 4.95053],
                ]
            ],
        },
    },
]
