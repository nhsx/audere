// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

provider "aws" {
  version = "~> 2.61"
  region  = "us-west-2"
}

data "terraform_remote_state" "policy" {
  backend = "s3"
  config = {
    bucket = "global-terraform.auderenow.io"
    key    = "policy/terraform.state"
    region = "us-west-2"
  }
}

resource "aws_iam_access_key" "ecr_push" {
  user = data.terraform_remote_state.policy.outputs.ecr_push_user
}
