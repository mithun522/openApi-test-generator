/* Sample OpenAPI contract for the "Load sample contract" button. */
"use strict";

const SAMPLE = `openapi: 3.0.3
info:
  title: Pet Store
  version: 1.0.0
servers:
  - url: https://api.petstore.example.com/v1
security:
  - bearerAuth: []
paths:
  /pets:
    get:
      tags: [pets]
      operationId: listPets
      parameters:
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 100 }
        - name: status
          in: query
          schema: { type: string, enum: [available, pending, sold] }
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/Pet" }
        "400": { description: Bad request }
        "401": { description: Unauthorized }
    post:
      tags: [pets]
      operationId: createPet
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/NewPet" }
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Pet" }
        "400": { description: Validation error }
        "401": { description: Unauthorized }
  /pets/{petId}:
    parameters:
      - name: petId
        in: path
        required: true
        schema: { type: integer, minimum: 1 }
    get:
      tags: [pets]
      operationId: getPet
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Pet" }
        "400": { description: Invalid id }
        "401": { description: Unauthorized }
        "404": { description: Not found }
    delete:
      tags: [pets]
      operationId: deletePet
      responses:
        "204": { description: Deleted }
        "401": { description: Unauthorized }
        "403": { description: Forbidden }
        "404": { description: Not found }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    NewPet:
      type: object
      additionalProperties: false
      required: [name, species]
      properties:
        name: { type: string, minLength: 1, maxLength: 50 }
        species: { type: string, enum: [dog, cat, bird] }
        age: { type: integer, minimum: 0, maximum: 30 }
        ownerEmail: { type: string, format: email }
        tags:
          type: array
          maxItems: 5
          items: { type: string }
    Pet:
      allOf:
        - $ref: "#/components/schemas/NewPet"
        - type: object
          required: [id]
          properties:
            id: { type: integer, readOnly: true }
`;
