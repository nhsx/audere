// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

terraform {
  backend "s3" {
    bucket = "flu-prod-terraform.auderenow.io"
    key    = "api/terraform.state"
    region = "us-west-2"
  }
}

provider "aws" {
  version = "~> 2.61"
  region  = "us-west-2"
}

provider "template" {
  version = "~> 2.1"
}

module "shared" {
  source = "../../modules/app-shared"

  app_subnet_id              = data.terraform_remote_state.network.outputs.app_subnet_id
  db_client_sg_id            = data.terraform_remote_state.network.outputs.db_client_sg_id
  dev_ssh_server_sg_id       = data.terraform_remote_state.network.outputs.dev_ssh_server_sg_id
  devs                       = var.devs
  environment                = "prod"
  infra_alerts_sns_topic_arn = data.terraform_remote_state.flu_notifier.outputs.infra_alerts_sns_topic_arn
  internet_egress_sg_id      = data.terraform_remote_state.network.outputs.internet_egress_sg_id
  reporting_server_sg_id     = data.terraform_remote_state.network.outputs.reporting_server_sg_id
}

module "flu_api" {
  source = "../../modules/flu-api"

  account                      = var.account
  app_subnet_id                = data.terraform_remote_state.network.outputs.app_subnet_id
  app_b_subnet_id              = data.terraform_remote_state.network.outputs.app_b_subnet_id
  auderenow_certificate_arn    = module.shared.auderenow_certificate_arn
  auderenow_route53_zone_id    = module.shared.auderenow_route53_zone_id
  auderenow_route53_zone_name  = module.shared.auderenow_route53_zone_name
  chills_virena_bucket         = module.shared.chills_virena_bucket_arn
  cough_aspren_bucket          = module.shared.cough_aspren_bucket_arn
  cough_qualtrics_bucket       = module.shared.cough_follow_ups_bucket_arn
  audere_share_bucket          = data.terraform_remote_state.global.outputs.audere_share_arn
  db_client_sg_id              = data.terraform_remote_state.network.outputs.db_client_sg_id
  dev_ssh_server_sg_id         = data.terraform_remote_state.network.outputs.dev_ssh_server_sg_id
  ecs_cluster_id               = module.shared.ecs_cluster_id
  ecs_cluster_name             = module.shared.ecs_cluster_name
  ecs_service_linked_role_arn  = data.terraform_remote_state.global.outputs.ecs_service_linked_role_arn
  elb_logs_bucket_id           = module.shared.elb_logs_bucket_id
  environment                  = "prod"
  fluapi_client_sg_id          = data.terraform_remote_state.network.outputs.fluapi_client_sg_id
  fluapi_internal_client_sg_id = data.terraform_remote_state.network.outputs.fluapi_internal_client_sg_id
  fluapi_internal_server_sg_id = data.terraform_remote_state.network.outputs.fluapi_internal_server_sg_id
  fluapi_server_sg_id          = data.terraform_remote_state.network.outputs.fluapi_server_sg_id
  infra_alerts_sns_topic_arn   = data.terraform_remote_state.flu_notifier.outputs.infra_alerts_sns_topic_arn
  internet_egress_sg_id        = data.terraform_remote_state.network.outputs.internet_egress_sg_id
  public_http_sg_id            = data.terraform_remote_state.network.outputs.public_http_sg_id
  region                       = var.region
  ssm_parameters_key_arn       = data.terraform_remote_state.global.outputs.ssm_parameters_key_arn
  transient_subnet_id          = data.terraform_remote_state.network.outputs.transient_subnet_id
  vpc_id                       = data.terraform_remote_state.network.outputs.vpc_id
}

module "reporting" {
  source = "../../modules/reporting"

  account                     = var.account
  app_subnet_id               = data.terraform_remote_state.network.outputs.app_subnet_id
  auderenow_certificate_arn   = module.shared.auderenow_certificate_arn
  auderenow_route53_zone_id   = module.shared.auderenow_route53_zone_id
  auderenow_route53_zone_name = module.shared.auderenow_route53_zone_name
  ecs_cluster_id              = module.shared.ecs_cluster_id
  ecs_service_linked_role_arn = data.terraform_remote_state.global.outputs.ecs_service_linked_role_arn
  elb_logs_bucket_id          = module.shared.elb_logs_bucket_id
  environment                 = "prod"
  metabase_database_address   = data.terraform_remote_state.flu_db.outputs.metabase_database_address
  public_http_sg_id           = data.terraform_remote_state.network.outputs.public_http_sg_id
  region                      = var.region
  reporting_client_sg_id      = data.terraform_remote_state.network.outputs.reporting_client_sg_id
  ssm_parameters_key_arn      = data.terraform_remote_state.global.outputs.ssm_parameters_key_arn
}

module "vpc_cidr" {
  source = "../../modules/vpc-cidr"
}

data "terraform_remote_state" "flu_db" {
  backend = "s3"
  config = {
    bucket = "flu-prod-terraform.auderenow.io"
    key    = "db/terraform.state"
    region = "us-west-2"
  }
}

data "terraform_remote_state" "flu_notifier" {
  backend = "s3"
  config = {
    bucket = "flu-prod-terraform.auderenow.io"
    key    = "notifier/terraform.state"
    region = "us-west-2"
  }
}

data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "flu-prod-terraform.auderenow.io"
    key    = "network/terraform.state"
    region = "us-west-2"
  }
}

data "terraform_remote_state" "global" {
  backend = "s3"
  config = {
    bucket = "global-terraform.auderenow.io"
    key    = "policy/terraform.state"
    region = "us-west-2"
  }
}
