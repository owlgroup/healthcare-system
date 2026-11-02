---
number: 1
title: Choose RESTful API for Service Communication
status: proposed
decided_at: 2026-09-27
---

# ADR-0001: Choose RESTful API for Service Communication

## Context
The project healthcare-system-ns requires efficient communication between various microservices. A decision on the architectural style of the API is critical to ensure interoperability, scalability, and ease of integration with third-party systems, considering the healthcare domain's regulatory and operational requirements.

## Decision
We propose to adopt a RESTful API architecture for service communication within the healthcare-system-ns project. REST (Representational State Transfer) APIs are stateless and leverage standard HTTP methods, making them simple to use and widely supported across different platforms and programming languages.

## Consequences

### Positive
- **Interoperability**: REST APIs can be consumed easily by different clients (web, mobile, etc.), enhancing integration capabilities.
- **Scalability**: The stateless nature of REST allows for better load distribution and scalability of service instances.
- **Simplicity**: Developers are familiar with REST, which can reduce onboarding time and increase productivity.

### Negative
- **Overhead**: REST can introduce some overhead due to the stateless nature and potentially verbose data formats like JSON, which may affect performance in high-throughput scenarios.
- **Versioning**: Managing the versioning of APIs can become complex over time as the service evolves.

### Follow-ups
- Further investigation into the data formats (e.g., JSON, XML) will be necessary to determine the optimal choice for our APIs.
- Establish a strategy for API versioning to manage future changes effectively.
Commit to GitHub