# Automotive Taxonomy

Status: Phase 4 implemented  
Last updated: 2026-08-15

## Classification contract

Every part has one required security domain, one required primary category
inside that domain, and optional secondary tags. Only the security domain and
primary category grant visibility. Secondary tags improve discovery but never
broaden access.

Categories use immutable numeric IDs and stable slugs. Display names may change
without changing permissions, URLs, or generated data.

## Root hierarchy

```text
automotive
|-- braking
|-- tyres-wheels
|-- steering
|-- engine
|-- transmission
|-- suspension
|-- electrical
|-- battery
|-- body
|-- interior
|-- safety
|-- adas
`-- thermal
```

Org A receives the `automotive` root with descendants. Org B receives
`braking`, Org C receives `tyres-wheels`, and Org D receives `steering`.

## Braking

```text
braking
|-- friction
|   |-- brake-pads
|   `-- brake-shoes
|-- rotors-drums
|   |-- brake-rotors
|   `-- brake-drums
|-- calipers
|-- hydraulics
|   |-- master-cylinders
|   |-- brake-lines
|   |-- hoses
|   `-- brake-fluid
|-- abs
|   |-- abs-modules
|   |-- wheel-speed-sensors
|   `-- tone-rings
|-- parking-brake
`-- brake-controls
```

## Tyres and Wheels

```text
tyres-wheels
|-- tyres
|   |-- summer-tyres
|   |-- winter-tyres
|   |-- all-season-tyres
|   |-- performance-tyres
|   `-- commercial-tyres
|-- wheels-rims
|   |-- alloy-wheels
|   `-- steel-wheels
|-- hubs-bearings
|   |-- wheel-hubs
|   `-- wheel-bearings
|-- tpms
|   |-- tpms-sensors
|   `-- tpms-service-kits
|-- valves
`-- wheel-fasteners
```

## Steering

```text
steering
|-- steering-gears
|   |-- steering-racks
|   `-- steering-boxes
|-- steering-columns
|-- steering-wheels
|-- steering-linkage
|   |-- tie-rods
|   |-- drag-links
|   `-- ball-joints
|-- power-assist
|   |-- hydraulic-pumps
|   |-- eps-motors
|   `-- reservoirs
`-- steering-controls
    |-- angle-sensors
    `-- control-modules
```

## Other automotive domains

| Domain       | Initial children                                            |
| ------------ | ----------------------------------------------------------- |
| Engine       | Air intake, fuel, ignition, lubrication, timing, exhaust    |
| Transmission | Manual, automatic, clutch, torque converter, differential   |
| Suspension   | Springs, dampers, control arms, stabilizers, mounts         |
| Electrical   | Wiring, connectors, sensors, relays, power distribution     |
| Battery      | Low-voltage, high-voltage, modules, BMS, charging           |
| Body         | Panels, closures, structure, glass, sealing                 |
| Interior     | Seats, trim, cockpit, controls, restraint interfaces        |
| Safety       | Passive safety, active safety, restraints, crash structures |
| ADAS         | Cameras, radar, lidar, controllers, driver monitoring       |
| Thermal      | Cooling, HVAC, heat exchangers, battery thermal management  |

Their top-level slugs are reserved. Final leaf categories are completed before
five-million-row generation.

## Multi-category example

```text
Part: ABS wheel-speed sensor
Security domain: braking
Primary category: braking / abs / wheel-speed-sensors
Secondary tags:
- electrical / sensors
- safety / active-safety
```

The part remains a Braking security record. An Electrical entitlement alone
does not reveal it.

## Five-million-row distribution

| Group                      |          Rows |
| -------------------------- | ------------: |
| Braking                    |     1,250,000 |
| Tyres and Wheels           |     1,250,000 |
| Steering                   |     1,250,000 |
| Other ten domains combined |     1,250,000 |
| **Total**                  | **5,000,000** |

The ten other domains initially receive 125,000 primary records each. Leaf
distribution is deterministic and approximately balanced unless a documented
realism rule requires otherwise.

## Generated vocabulary

Generated names/descriptions use domain-specific terms:

- Braking: ceramic pad, ventilated rotor, hydraulic caliper, ABS sensor
- Tyres/Wheels: radial tyre, alloy rim, TPMS sensor, wheel-bearing assembly
- Steering: electric rack, steering column, EPS motor, tie-rod end
- Engine: intake manifold, fuel rail, ignition coil, timing component

Manufacturer, program, region, plant, year, material, status, cost, weight, and
timestamps remain independently distributed with stable seeded hashes.

## Integrity rules

- Slugs are unique among siblings and immutable after use.
- A category cannot be its own ancestor.
- Security domains are direct children of `automotive`.
- A primary category must descend from its security domain.
- Exactly one category assignment per part is primary.
- Secondary assignments cannot duplicate the primary assignment.
- Inactive categories cannot receive new assignments.
- Assigned categories are deactivated/migrated rather than deleted.
- Entitlement inheritance follows descendants only when explicitly enabled.

## Security-aware search behavior

- Facets contain only categories visible to the current user.
- Returned secondary tags are filtered to discoverable branches.
- `brake-pads` access does not include sibling `brake-rotors`.
- Search text never overrides the domain/category boundary.
- Counts are computed after access filters.

## Decisions deferred until generation

- Final leaves for the ten Other domains
- Whether category editing is Global-Administrator-only
- Whether display names need localization
- How deprecated categories redirect to replacements
