#!/bin/bash
# Server setup script - runs automatically on EC2 launch

apt-get update
apt-get install -y curl git nginx python3-pip
pip3 install --upgrade awscli

# Signal that server is ready for deployment
touch /tmp/server-ready