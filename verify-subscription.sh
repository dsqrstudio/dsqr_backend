#!/bin/bash
echo "Waiting for payment to complete..."
sleep 3
echo ""
cd c:/Users/ADMIN/OneDrive/Desktop/dsqr_new/backend
node src/seed/checkSubscription.js
