// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

data "aws_iam_policy_document" "assume_ec2_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_role" {
  name               = "${local.base_name}-ecs"
  assume_role_policy = data.aws_iam_policy_document.assume_ec2_role_policy.json
}

resource "aws_iam_instance_profile" "ecs" {
  name = "${local.base_name}-ecs"
  role = aws_iam_role.ecs_role.name
}

resource "aws_iam_role_policy_attachment" "ecs_attachment" {
  role       = aws_iam_role.ecs_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

data "aws_iam_policy_document" "ecs_cloudwatch_policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]

    resources = ["arn:aws:logs:*:*:*"]
  }

  statement {
    actions = [
      "cloudwatch:ListMetrics",
      "cloudwatch:PutMetricData",
      "cloudwatch:PutEvents",
      "ec2:DescribeTags",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecs_cloudwatch" {
  name   = "${local.base_name}-ecs-cloudwatch"
  policy = data.aws_iam_policy_document.ecs_cloudwatch_policy.json
}

resource "aws_iam_policy_attachment" "ecs_cloudwatch_attachment" {
  name       = "${local.base_name}-ecs-cloudwatch"
  roles      = [aws_iam_role.ecs_role.name]
  policy_arn = aws_iam_policy.ecs_cloudwatch.arn
}

