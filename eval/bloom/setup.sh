#!/bin/bash
# Install Bloom behavioral evaluation framework
pip install git+https://github.com/safety-research/bloom.git

# Initialize Bloom workspace in eval/bloom
cd eval/bloom
bloom init
