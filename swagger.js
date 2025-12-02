import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node MySQL JWT API Development',
      version: '1.0.0',
      description: 'Complete Banking Solution With Latest API.'
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 5000}` }]
  },
  apis: ['./routes/*.js'] // files containing annotations
};

const swaggerSpec = swaggerJsdoc(options);

export const swaggerSetup = swaggerUi.setup(swaggerSpec);
export const swaggerServe = swaggerUi.serve;