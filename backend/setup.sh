#!/bin/bash
# backend/setup.sh

echo "Setting up backend environment..."

# Create .env file
cat > .env << 'ENVEOF'
# Firebase Admin Configuration
FIREBASE_PROJECT_ID=optisync-a5182
FIREBASE_PRIVATE_KEY_ID=f0a13ec3cd33e22a218718dbecf9af9dbc7a1c8b
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2qJvYi4VtmaUU\nviLI8m1L83pnkz3Use98Vcrr7Yi+L2aNVDhEiUM8H/8rrangQKxML+hgwAgEi8Zp\noiIc8kP+WWHijY3vC8uhcNJ0a0u91N71oNCDNjEq5XdJdxG4XGvZ99+h4eYG3VEG\ngokDdb21PFFGd2Vu59w0J3fmslmfCbioJpOz4Ws44Biu3G8q9PuNFYHCx1uLgZxQ\naTqCDgCll8Skc9kPazrSk5PM5wWTL9+sVNk960x7LNjd1SQhW/YD7lxZO3lwSE78\nrMKR95xED41MeXXFU3h6N5eCvfVXoAbp+gZ7i4yD60I7MbYyN/3vSOG+M5TllOGr\n+JwS6nJlAgMBAAECggEAGJ2gYw5qbNrH5IO7LFl/YTzuwgaVzpQsMhVdw22/f+Hj\ncChpbNMSvIeTW8+LlS0iCyJprqAydGph0tqGvl/nyd9B0cZB2nU8fAU4V3gePPbz\nFScW8pfbCGzkJoJlYPMTlcxR1v8agNJSmQ3+aPj1F/eI/HYatVeJ1X18Kxrd+RCb\nrQ+kvqANzD5Ju/R/QrvgOjbkrDVdL3Mjsu+jvbRB1iVIBoLf7sEDcm3ZzgjG6k1/\n7jw07seBeWCV9b3WaLeVDf5j8cgAmk4opFRfnqFX3yWVmsQDDUwTVZ8APUpZ7XPG\nZGmWEWcBarvx4yiQN2OFis53H9EgQvmcoh/GN6NAAQKBgQDxqxo0FCNBOPyluTTD\n5tI2aq+8CbV2j9CqNS5vbtOYJPe4efMK4/5dL1+X1e0YiR2ySK181NbAOrJ5VpLI\nJEtnvTIF9UGJldUa5BrENnzFQtJeeKsgtCraFqm+O2YJpEa0HcbeaaM2Icf4iRGw\nzH3X9aeO47UP+iNjkfvbpjDyRQKBgQDBfaXUFHkqkhbBChytYBpWHgRpzpN6LU4S\nZN88xnl+djdJ+BmpfBfusnhEbo25eMia9lECHvsIhCDil2GLGlcc9IyDXv4Kr1sA\ni6vZofHW/ZpDORerwPO7F+RnTJoHw6W71fCIrdGH9MPZfWqXBZ5pRRuz1LCamRH3\nu3uVFFWRoQKBgGI2kR2dGX7GNBb9n64FvmSTEvwuTerzI3Ao0MhEmAV68JmuJdHF\nOniQah8At6yC/OiZlLfon6XbtPCO+HQSG/r67rtxIsNRexvEnAQlyKs6Lthp3dIa\nplefYjiHVz6P3pQQjeORttym+efNfL0HPhVoJkJx1AG8PGmYyGxJrBapAoGBAKJp\nNyJ3NOVYzqSmOkAFJNYYSBgP/5ZUJO4noYJADobp76q1B8VNlkETqQO30FpYWfpI\nuuKO4qPZVEkeTBAYwfpaAv/aYl7Rpg8lLdB1sKuHH09Bwu61/V+TxHI4yCmwPZMX\nFtmDHReDikkqjqfJXZh7G6+s3bhGt+A7jJYsBU9BAoGBAOrFJ8kmwYJiPRz50mXf\nrzJYMdxTcQcFUvvtti9JnVVxHDCmBqRtersszSMJvmRPxYh7v2CvsXeVtEVst1wu\nss7xO/uU8dwY/cnWiqlHeP56seZpj5DPxVY54a1644ToAFlJiPJMb//2nspQjCBi\nxTnjSaSDF6u1BebVqR4o554g\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@optisync-a5182.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=100530519656703701730
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40optisync-a5182.iam.gserviceaccount.com

ML_MODEL_PATH=./models
FORECAST_PERIOD_DAYS=180
ENVEOF

echo ".env file created successfully!"
echo ""
echo "Your backend is now configured with:"
echo "  - Project ID: optisync-a5182"
echo "  - Client Email: firebase-adminsdk-fbsvc@optisync-a5182.iam.gserviceaccount.com"
echo ""
echo "You can now run: python app.py"
